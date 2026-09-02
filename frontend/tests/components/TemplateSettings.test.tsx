import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TemplateSettings } from '@/components/TemplateSettings';

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
let catalog: Array<Record<string, unknown>>;
let customDetails: Record<string, unknown>;

vi.mock('@tauri-apps/api/core', () => ({ invoke }));

describe('TemplateSettings', () => {
  beforeEach(() => {
    catalog = [
      {
        id: 'daily_standup',
        name: 'Daily Standup',
        description: 'Daily updates',
        origin: 'built_in',
        isGlobalDefault: false,
      },
      {
        id: 'standard_meeting',
        name: 'Standard Meeting Notes',
        description: 'General meetings',
        origin: 'built_in',
        isGlobalDefault: true,
      },
      {
        id: 'custom_retro',
        name: 'My Retro',
        description: 'Team reflection',
        origin: 'custom',
        isGlobalDefault: false,
      },
    ];
    customDetails = {
      id: 'custom_retro',
      name: 'My Retro',
      description: 'Team reflection',
      origin: 'custom',
      sections: [{
        title: 'Summary',
        instruction: 'Summarize the meeting',
        format: 'paragraph',
        item_format: null,
      }],
    };
    invoke.mockImplementation((command: string, args?: { templateId?: string; template?: any }) => {
      if (command === 'api_migrate_legacy_templates') {
        return Promise.resolve({ migratedTemplates: [] });
      }
      if (command === 'api_list_templates') {
        return Promise.resolve([...catalog]);
      }
      if (command === 'api_get_template_details') {
        if (args?.templateId === customDetails.id) return Promise.resolve(customDetails);
        return Promise.resolve({
          id: args?.templateId,
          name: args?.templateId === 'custom_retro' ? 'My Retro' : 'Standard Meeting Notes',
          description: args?.templateId === 'custom_retro' ? 'Team reflection' : 'General meetings',
          origin: args?.templateId === 'custom_retro' ? 'custom' : 'built_in',
          sections: [{
            title: 'Summary',
            instruction: 'Summarize the meeting',
            format: 'paragraph',
            item_format: null,
          }],
        });
      }
      if (command === 'api_create_template') {
        const created = { id: 'custom_created', origin: 'custom', ...args?.template };
        customDetails = created;
        catalog.push({
          id: created.id,
          name: created.name,
          description: created.description,
          origin: 'custom',
          isGlobalDefault: false,
        });
        return Promise.resolve(created);
      }
      throw new Error(`Unexpected command: ${command}`);
    });
  });

  it('groups the catalog and selects the read-only global default', async () => {
    render(<TemplateSettings />);

    expect(await screen.findByRole('heading', { name: 'Built-in' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Custom' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Standard Meeting Notes.*Default/ })).toHaveAttribute(
      'aria-current',
      'true',
    );
    expect(await screen.findByDisplayValue('Standard Meeting Notes')).toBeDisabled();
    expect(screen.getByLabelText('Section 1 output style')).toBeDisabled();
  });

  it('renders a persistence failure as an accessible error', async () => {
    invoke.mockRejectedValueOnce(new Error('disk unavailable'));
    render(<TemplateSettings />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Could not load templates');
    });
  });

  it('creates and saves an ordered structured template without exposing JSON', async () => {
    const user = userEvent.setup();
    render(<TemplateSettings />);
    await screen.findByDisplayValue('Standard Meeting Notes');

    await user.click(screen.getByRole('button', { name: 'Create template' }));
    expect(screen.getByDisplayValue('Untitled Template')).toBeEnabled();
    expect(screen.queryByText(/raw json/i)).not.toBeInTheDocument();

    await user.type(screen.getByLabelText('Description'), 'A product review format');
    await user.type(screen.getByLabelText('Title'), 'Discussion');
    await user.type(screen.getByLabelText('Instruction'), 'Capture the discussion');
    await user.click(screen.getByRole('button', { name: 'Add section' }));

    const titles = screen.getAllByLabelText('Title');
    const instructions = screen.getAllByLabelText('Instruction');
    await user.type(titles[1], 'Outcome');
    await user.type(instructions[1], 'Capture the outcome');
    await user.selectOptions(screen.getByLabelText('Section 2 output style'), 'list');
    await user.click(screen.getByRole('button', { name: 'Move section 2 up' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith('api_create_template', {
        template: expect.objectContaining({
          name: 'Untitled Template',
          description: 'A product review format',
          sections: [
            expect.objectContaining({ title: 'Outcome', format: 'list' }),
            expect.objectContaining({ title: 'Discussion', format: 'paragraph' }),
          ],
        }),
      });
    });
    expect(await screen.findByRole('button', { name: 'Untitled Template' })).toHaveAttribute(
      'aria-current',
      'true',
    );
  });
});
