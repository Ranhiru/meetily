import { invoke } from '@tauri-apps/api/core';
import type {
  DeleteImpact,
  EffectiveTemplate,
  ManagedTemplate,
  TemplateDescriptor,
  TemplateDraft,
} from '@/types/templates';

export const TEMPLATE_CATALOG_CHANGED_EVENT = 'meetily:template-catalog-changed';

function announceCatalogChange() {
  window.dispatchEvent(new Event(TEMPLATE_CATALOG_CHANGED_EVENT));
}

export async function migrateLegacyTemplates() {
  return invoke<{ migratedTemplates: ManagedTemplate[] }>('api_migrate_legacy_templates');
}

export async function listTemplates() {
  return invoke<TemplateDescriptor[]>('api_list_templates');
}

export async function getTemplate(templateId: string) {
  return invoke<ManagedTemplate>('api_get_template_details', { templateId });
}

export async function createTemplate(template: TemplateDraft) {
  const created = await invoke<ManagedTemplate>('api_create_template', { template });
  announceCatalogChange();
  return created;
}

export async function updateTemplate(templateId: string, template: TemplateDraft) {
  const updated = await invoke<ManagedTemplate>('api_update_template', { templateId, template });
  announceCatalogChange();
  return updated;
}

export async function duplicateTemplate(templateId: string) {
  const duplicate = await invoke<ManagedTemplate>('api_duplicate_template', { templateId });
  announceCatalogChange();
  return duplicate;
}

export async function setGlobalTemplateDefault(templateId: string) {
  const descriptor = await invoke<TemplateDescriptor>('api_set_global_template_default', {
    templateId,
  });
  announceCatalogChange();
  return descriptor;
}

export async function getEffectiveTemplate(meetingId?: string) {
  return invoke<EffectiveTemplate>('api_get_effective_template', {
    meetingId: meetingId ?? null,
  });
}

export async function setMeetingTemplateOverride(
  meetingId: string,
  templateId: string | null,
) {
  const effective = await invoke<EffectiveTemplate>('api_set_meeting_template_override', {
    meetingId,
    templateId,
  });
  announceCatalogChange();
  return effective;
}

export async function getTemplateDeletionImpact(templateId: string) {
  return invoke<DeleteImpact>('api_get_template_deletion_impact', { templateId });
}

export async function deleteTemplate(templateId: string) {
  const impact = await invoke<DeleteImpact>('api_delete_template', { templateId });
  announceCatalogChange();
  return impact;
}
