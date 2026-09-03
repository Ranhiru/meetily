export type TemplateOrigin = 'built_in' | 'custom';
export type TemplateOutputStyle = 'paragraph' | 'list' | 'string';

export interface TemplateSection {
  title: string;
  instruction: string;
  format: TemplateOutputStyle;
  item_format?: string | null;
}

export interface TemplateDraft {
  name: string;
  description: string;
  sections: TemplateSection[];
}

export interface TemplateDescriptor {
  id: string;
  name: string;
  description: string;
  origin: TemplateOrigin;
  isGlobalDefault: boolean;
}

export interface ManagedTemplate extends TemplateDraft {
  id: string;
  origin: TemplateOrigin;
}

export interface EffectiveTemplate {
  id: string;
  name: string;
  meetingOverrideId: string | null;
  inherited: boolean;
  recoveryNotice: string | null;
}

export interface DeleteImpact {
  referencedMeetings: number;
  isGlobalDefault: boolean;
}
