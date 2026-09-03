'use client';

import { Check, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { TemplateDescriptor } from '@/types/templates';

interface MeetingTemplateSelectorProps {
  templates: TemplateDescriptor[];
  meetingOverrideId: string | null;
  globalDefaultName: string;
  onSelect: (templateId: string | null, templateName: string) => Promise<void>;
  disabled?: boolean;
}

export function MeetingTemplateSelector({
  templates,
  meetingOverrideId,
  globalDefaultName,
  onSelect,
  disabled = false,
}: MeetingTemplateSelectorProps) {
  if (templates.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" aria-label="Select summary template" disabled={disabled}>
          <FileText />
          <span className="hidden lg:inline">Template</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={() => void onSelect(null, globalDefaultName)}
          disabled={disabled}
          className="flex items-center justify-between gap-2"
        >
          <span>Use global default — {globalDefaultName}</span>
          {meetingOverrideId === null && <Check aria-label="Selected" className="h-4 w-4 text-green-600" />}
        </DropdownMenuItem>
        {(['built_in', 'custom'] as const).map((origin) => (
          <div key={origin}>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>{origin === 'built_in' ? 'Built-in' : 'Custom'}</DropdownMenuLabel>
            {templates.filter((template) => template.origin === origin).map((template) => (
              <DropdownMenuItem
                key={template.id}
                onClick={() => void onSelect(template.id, template.name)}
                disabled={disabled}
                title={template.description}
                className="flex items-center justify-between gap-2"
              >
                <span>{template.name}</span>
                {meetingOverrideId === template.id && <Check aria-label="Selected" className="h-4 w-4 text-green-600" />}
              </DropdownMenuItem>
            ))}
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
