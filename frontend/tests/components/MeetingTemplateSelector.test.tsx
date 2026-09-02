import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MeetingTemplateSelector } from '@/components/MeetingDetails/MeetingTemplateSelector';

const templates = [
  {
    id: 'standard_meeting',
    name: 'Standard Meeting Notes',
    description: 'General meetings',
    origin: 'built_in' as const,
    isGlobalDefault: true,
  },
  {
    id: 'custom_retro',
    name: 'My Retro',
    description: 'Team reflection',
    origin: 'custom' as const,
    isGlobalDefault: false,
  },
];

describe('MeetingTemplateSelector', () => {
  it('shows inherited and grouped choices and persists an explicit override', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <MeetingTemplateSelector
        templates={templates}
        meetingOverrideId={null}
        globalDefaultName="Standard Meeting Notes"
        onSelect={onSelect}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Select summary template' }));
    expect(screen.getByText('Use global default — Standard Meeting Notes')).toBeInTheDocument();
    expect(screen.getByText('Built-in')).toBeInTheDocument();
    expect(screen.getByText('Custom')).toBeInTheDocument();
    await user.click(screen.getByRole('menuitem', { name: /My Retro/ }));

    expect(onSelect).toHaveBeenCalledWith('custom_retro', 'My Retro');
  });

  it('clears an explicit override by selecting the global default', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <MeetingTemplateSelector
        templates={templates}
        meetingOverrideId="custom_retro"
        globalDefaultName="Standard Meeting Notes"
        onSelect={onSelect}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Select summary template' }));
    await user.click(screen.getByRole('menuitem', { name: /Use global default/ }));

    expect(onSelect).toHaveBeenCalledWith(null, 'Standard Meeting Notes');
  });
});
