import { createRef } from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TemplateSettings, type TemplateSettingsHandle } from '@/components/TemplateSettings';
import { toast } from 'sonner';

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
let catalog: Array<Record<string, unknown>>;
let customDetails: Record<string, unknown>;
let deleteImpact: Record<string, unknown>;

vi.mock('@tauri-apps/api/core', () => ({ invoke }));
vi.mock('sonner', () => ({
  toast: { info: vi.fn(), success: vi.fn(), error: vi.fn() },
}));

const baseSection = {
  title: 'Summary',
  instruction: 'Summarize the meeting',
  format: 'paragraph',
  item_format: null,
};

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
      {
        id: 'one_on_one',
        name: 'One on One',
        description: 'Manager syncs',
        origin: 'custom',
        isGlobalDefault: false,
      },
    ];
    customDetails = {
      id: 'custom_retro',
      name: 'My Retro',
      description: 'Team reflection',
      origin: 'custom',
      sections: [{ ...baseSection }],
    };
    deleteImpact = { referencedMeetings: 0, isGlobalDefault: false };
    invoke.mockImplementation((command: string, args?: any) => {
      if (command === 'api_migrate_legacy_templates') {
        return Promise.resolve({ migratedTemplates: [] });
      }
      if (command === 'api_list_templates') {
        return Promise.resolve([...catalog]);
      }
      if (command === 'api_get_template_details') {
        if (args?.templateId === customDetails.id) return Promise.resolve(customDetails);
        const descriptor = catalog.find((template) => template.id === args?.templateId);
        return Promise.resolve({
          id: args?.templateId,
          name: descriptor?.name ?? 'Unknown',
          description: descriptor?.description ?? '',
          origin: descriptor?.origin ?? 'custom',
          sections: [{ ...baseSection }],
        });
      }
      if (command === 'api_create_template') {
        const created = { id: 'custom_created', origin: 'custom', ...args?.template };
        customDetails = created;
        catalog = [
          ...catalog,
          {
            id: created.id,
            name: created.name,
            description: created.description,
            origin: 'custom',
            isGlobalDefault: false,
          },
        ];
        return Promise.resolve(created);
      }
      if (command === 'api_update_template') {
        const descriptor = catalog.find((template) => template.id === args?.templateId);
        const updated = { id: args?.templateId, origin: descriptor?.origin ?? 'custom', ...args?.template };
        if (args?.templateId === customDetails.id) customDetails = updated;
        catalog = catalog.map((template) =>
          template.id === args?.templateId
            ? { ...template, name: updated.name, description: updated.description }
            : template,
        );
        return Promise.resolve(updated);
      }
      if (command === 'api_duplicate_template') {
        const source = catalog.find((template) => template.id === args?.templateId);
        const copy = {
          id: `${args?.templateId}_copy`,
          name: `${source?.name} Copy`,
          description: source?.description,
          origin: 'custom',
          sections: [{ ...baseSection }],
        };
        catalog = [
          ...catalog,
          {
            id: copy.id,
            name: copy.name,
            description: copy.description,
            origin: 'custom',
            isGlobalDefault: false,
          },
        ];
        return Promise.resolve(copy);
      }
      if (command === 'api_get_template_deletion_impact') {
        return Promise.resolve(deleteImpact);
      }
      if (command === 'api_set_global_template_default') {
        catalog = catalog.map((template) => ({
          ...template,
          isGlobalDefault: template.id === args?.templateId,
        }));
        return Promise.resolve(catalog.find((template) => template.id === args?.templateId));
      }
      if (command === 'api_delete_template') {
        catalog = catalog.filter((template) => template.id !== args?.templateId);
        return Promise.resolve(deleteImpact);
      }
      throw new Error(`Unexpected command: ${command}`);
    });
  });

  it('announces loading while the catalog is fetched', async () => {
    invoke.mockImplementation((command: string) => {
      if (command === 'api_migrate_legacy_templates') return new Promise(() => {});
      throw new Error(`Unexpected command: ${command}`);
    });
    render(<TemplateSettings />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading templates…');
  });

  it('shows a create-first empty state when no templates exist', async () => {
    invoke.mockImplementation((command: string) => {
      if (command === 'api_migrate_legacy_templates') return Promise.resolve({ migratedTemplates: [] });
      if (command === 'api_list_templates') return Promise.resolve([]);
      throw new Error(`Unexpected command: ${command}`);
    });
    render(<TemplateSettings />);
    expect(
      await screen.findByText('No templates are available. Create one to get started.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create template' })).toBeEnabled();
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

  it('explains invalid fields inline and blocks saving', async () => {
    const user = userEvent.setup();
    render(<TemplateSettings />);
    await screen.findByDisplayValue('Standard Meeting Notes');

    await user.click(screen.getByRole('button', { name: 'Create template' }));
    const save = screen.getByRole('button', { name: 'Save' });
    expect(save).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent('Description is required');
    expect(screen.getByRole('alert')).toHaveTextContent('Section 1 title is required');

    await user.clear(screen.getByLabelText('Template name'));
    await user.type(screen.getByLabelText('Template name'), 'my retro');
    expect(screen.getByRole('alert')).toHaveTextContent('Template name must be unique');

    await user.clear(screen.getByLabelText('Template name'));
    await user.type(screen.getByLabelText('Template name'), 'Product Review');
    await user.type(screen.getByLabelText('Description'), 'A product review format');
    await user.type(screen.getByLabelText('Title'), 'Discussion');
    await user.type(screen.getByLabelText('Instruction'), 'Capture the discussion');
    await user.click(screen.getByRole('button', { name: 'Add section' }));
    await user.type(screen.getAllByLabelText('Title')[1], 'discussion');
    await user.type(screen.getAllByLabelText('Instruction')[1], 'Capture the outcome');
    expect(screen.getByRole('alert')).toHaveTextContent('Section titles must be unique');
    expect(save).toBeDisabled();

    await user.clear(screen.getAllByLabelText('Title')[1]);
    await user.type(screen.getAllByLabelText('Title')[1], 'Outcome');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(save).toBeEnabled();
  });

  it('edits a custom template in place, discards cleanly, and renames preserve identity', async () => {
    const user = userEvent.setup();
    render(<TemplateSettings />);
    await screen.findByDisplayValue('Standard Meeting Notes');

    await user.click(screen.getByRole('button', { name: 'My Retro' }));
    await user.click(await screen.findByRole('button', { name: 'Edit' }));
    await user.clear(screen.getByLabelText('Description'));
    await user.type(screen.getByLabelText('Description'), 'Dirty description');
    await user.type(screen.getByLabelText(/Output pattern/), 'YYYY-MM-DD');

    await user.click(screen.getByRole('button', { name: 'Discard' }));
    expect(await screen.findByDisplayValue('Team reflection')).toBeInTheDocument();
    expect(screen.getByLabelText(/Output pattern/)).toHaveValue('');

    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await user.clear(screen.getByLabelText('Template name'));
    await user.type(screen.getByLabelText('Template name'), 'My Retro v2');
    await user.clear(screen.getByLabelText('Description'));
    await user.type(screen.getByLabelText('Description'), 'Improved reflection');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith('api_update_template', {
        templateId: 'custom_retro',
        template: expect.objectContaining({
          name: 'My Retro v2',
          description: 'Improved reflection',
        }),
      });
    });
    await screen.findByDisplayValue('My Retro v2');
    expect(screen.getByDisplayValue('My Retro v2')).toBeDisabled();
    await screen.findByRole('button', { name: 'My Retro v2' });
  });

  it('duplicates built-in and custom templates into selected custom copies', async () => {
    const user = userEvent.setup();
    render(<TemplateSettings />);
    await screen.findByDisplayValue('Standard Meeting Notes');

    expect(screen.queryByRole('button', { name: 'Set as default' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Daily Standup' }));
    await screen.findByRole('button', { name: 'Duplicate' });
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Set as default' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Duplicate' }));
    expect(invoke).toHaveBeenCalledWith('api_duplicate_template', { templateId: 'daily_standup' });
    expect(await screen.findByRole('button', { name: 'Daily Standup Copy' })).toHaveAttribute(
      'aria-current',
      'true',
    );

    await user.click(screen.getByRole('button', { name: 'My Retro' }));
    await user.click(await screen.findByRole('button', { name: 'Edit' }));
    await user.click(screen.getByRole('button', { name: 'Discard' }));
    await user.click(screen.getByRole('button', { name: 'Duplicate' }));
    expect(invoke).toHaveBeenCalledWith('api_duplicate_template', { templateId: 'custom_retro' });
    expect(await screen.findByRole('button', { name: 'My Retro Copy' })).toHaveAttribute(
      'aria-current',
      'true',
    );
  });

  it('confirms deletion with referenced-meeting impact and refreshes the catalog', async () => {
    const user = userEvent.setup();
    render(<TemplateSettings />);
    await screen.findByDisplayValue('Standard Meeting Notes');

    await user.click(screen.getByRole('button', { name: 'My Retro' }));
    await screen.findByRole('button', { name: 'Edit' });
    deleteImpact = { referencedMeetings: 2, isGlobalDefault: false };
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    const dialog = await screen.findByRole('alertdialog', {
      name: 'Permanently delete this template?',
    });
    expect(dialog).toHaveTextContent('2 meetings explicitly reference this template');
    expect(dialog).not.toHaveTextContent('The global default will return to Standard Meeting.');
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(
      screen.queryByRole('alertdialog', { name: 'Permanently delete this template?' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'My Retro' })).toBeInTheDocument();
    expect(invoke).not.toHaveBeenCalledWith('api_delete_template', expect.anything());

    await user.click(screen.getByRole('button', { name: 'Delete' }));
    const confirmDialog = await screen.findByRole('alertdialog', {
      name: 'Permanently delete this template?',
    });
    await user.click(within(confirmDialog).getByRole('button', { name: 'Delete permanently' }));

    expect(invoke).toHaveBeenCalledWith('api_delete_template', { templateId: 'custom_retro' });
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'My Retro' })).not.toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Standard Meeting Notes.*Default/ })).toHaveAttribute(
        'aria-current',
        'true',
      );
    });

    deleteImpact = { referencedMeetings: 0, isGlobalDefault: true };
    await user.click(screen.getByRole('button', { name: 'One on One' }));
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    const secondDialog = await screen.findByRole('alertdialog', {
      name: 'Permanently delete this template?',
    });
    expect(secondDialog).toHaveTextContent('The global default will return to Standard Meeting.');
    await user.click(within(secondDialog).getByRole('button', { name: 'Delete permanently' }));
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'One on One' })).not.toBeInTheDocument();
    });
  });

  it('offers save, discard, and cancel when switching templates with dirty edits', async () => {
    const user = userEvent.setup();
    render(<TemplateSettings />);
    await screen.findByDisplayValue('Standard Meeting Notes');

    await user.click(screen.getByRole('button', { name: 'My Retro' }));
    await user.click(await screen.findByRole('button', { name: 'Edit' }));
    await user.clear(screen.getByLabelText('Description'));
    await user.type(screen.getByLabelText('Description'), 'Dirty description');

    await user.click(screen.getByRole('button', { name: 'Daily Standup' }));
    const dialog = await screen.findByRole('dialog', { name: 'Save template changes?' });
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog', { name: 'Save template changes?' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Description')).toHaveValue('Dirty description');

    await user.click(screen.getByRole('button', { name: 'Daily Standup' }));
    const discardDialog = await screen.findByRole('dialog', { name: 'Save template changes?' });
    await user.click(within(discardDialog).getByRole('button', { name: 'Discard and continue' }));
    expect(await screen.findByDisplayValue('Daily Standup')).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'My Retro' }));
    await waitFor(() => {
      expect(screen.getByLabelText('Description')).toHaveValue('Team reflection');
    });
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await user.clear(screen.getByLabelText('Description'));
    await user.type(screen.getByLabelText('Description'), 'Valid update');
    await user.click(screen.getByRole('button', { name: 'Daily Standup' }));
    const saveDialog = await screen.findByRole('dialog', { name: 'Save template changes?' });
    await user.click(within(saveDialog).getByRole('button', { name: 'Save and continue' }));

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith('api_update_template', {
        templateId: 'custom_retro',
        template: expect.objectContaining({ description: 'Valid update' }),
      });
    });
    expect(await screen.findByDisplayValue('Daily Standup')).toBeDisabled();
  });

  it('exposes confirmNavigation for settings tab-change guards and reports dirty state', async () => {
    const user = userEvent.setup();
    const onDirtyChange = vi.fn();
    const ref = createRef<TemplateSettingsHandle>();
    render(<TemplateSettings ref={ref} onDirtyChange={onDirtyChange} />);
    await screen.findByDisplayValue('Standard Meeting Notes');
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);

    await user.click(screen.getByRole('button', { name: 'Create template' }));
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);

    const pending = ref.current!.confirmNavigation();
    const dialog = await screen.findByRole('dialog', { name: 'Save template changes?' });
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await expect(pending).resolves.toBe(false);

    const second = ref.current!.confirmNavigation();
    const secondDialog = await screen.findByRole('dialog', { name: 'Save template changes?' });
    await user.click(within(secondDialog).getByRole('button', { name: 'Discard and continue' }));
    await expect(second).resolves.toBe(true);
  });

  it('sets a selected template as the global default and moves the marker', async () => {
    const user = userEvent.setup();
    render(<TemplateSettings />);
    await screen.findByDisplayValue('Standard Meeting Notes');

    await user.click(screen.getByRole('button', { name: 'Daily Standup' }));
    await user.click(await screen.findByRole('button', { name: 'Set as default' }));

    expect(invoke).toHaveBeenCalledWith('api_set_global_template_default', {
      templateId: 'daily_standup',
    });
    expect(await screen.findByRole('button', { name: /Daily Standup.*Default/ })).toHaveAttribute(
      'aria-current',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Standard Meeting Notes' })).toBeInTheDocument();
  });

  it('announces recovered legacy templates as a visible notice on load', async () => {
    invoke.mockImplementation((command: string, args?: any) => {
      if (command === 'api_migrate_legacy_templates') {
        return Promise.resolve({ migratedTemplates: [{ id: 'migrated_standup' }] });
      }
      if (command === 'api_list_templates') return Promise.resolve([...catalog]);
      if (command === 'api_get_template_details') {
        const descriptor = catalog.find((template) => template.id === args?.templateId);
        return Promise.resolve({
          id: args?.templateId,
          name: descriptor?.name ?? 'Unknown',
          description: descriptor?.description ?? '',
          origin: descriptor?.origin ?? 'custom',
          sections: [{ ...baseSection }],
        });
      }
      throw new Error(`Unexpected command: ${command}`);
    });
    render(<TemplateSettings />);

    await screen.findByRole('heading', { name: 'Built-in' });
    expect(toast.info).toHaveBeenCalledWith(
      'Custom templates recovered',
      expect.objectContaining({
        description: '1 legacy template restored as independent copies.',
      }),
    );
  });

  it('reorders sections via keyboard and protects the final section', async () => {
    const user = userEvent.setup();
    render(<TemplateSettings />);
    await screen.findByDisplayValue('Standard Meeting Notes');

    await user.click(screen.getByRole('button', { name: 'Create template' }));
    await user.type(screen.getByLabelText('Description'), 'A product review format');
    await user.type(screen.getByLabelText('Title'), 'Discussion');
    await user.type(screen.getByLabelText('Instruction'), 'Capture the discussion');
    await user.click(screen.getByRole('button', { name: 'Add section' }));
    await user.type(screen.getAllByLabelText('Title')[1], 'Outcome');
    await user.type(screen.getAllByLabelText('Instruction')[1], 'Capture the outcome');

    expect(screen.getByRole('button', { name: 'Move section 1 up' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Move section 2 down' })).toBeDisabled();

    screen.getByRole('button', { name: 'Move section 2 up' }).focus();
    await user.keyboard('{Enter}');
    await waitFor(() => {
      expect(screen.getAllByLabelText('Title')[0]).toHaveValue('Outcome');
    });

    await user.click(screen.getAllByRole('button', { name: 'Remove' })[1]);
    expect(screen.getAllByLabelText('Title')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Remove' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith('api_create_template', {
        template: expect.objectContaining({
          sections: [expect.objectContaining({ title: 'Outcome', format: 'paragraph' })],
        }),
      });
    });
  });
});
