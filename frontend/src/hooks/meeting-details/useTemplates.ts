import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import Analytics from '@/lib/analytics';
import {
  getEffectiveTemplate,
  listTemplates,
  setMeetingTemplateOverride,
  TEMPLATE_CATALOG_CHANGED_EVENT,
} from '@/services/templateService';
import type { TemplateDescriptor } from '@/types/templates';

export function useTemplates(meetingId: string) {
  const [availableTemplates, setAvailableTemplates] = useState<TemplateDescriptor[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState('standard_meeting');
  const [meetingTemplateOverrideId, setMeetingTemplateOverrideId] = useState<string | null>(null);
  const [globalDefaultName, setGlobalDefaultName] = useState('Standard Meeting Notes');
  const [isTemplateSelectionPending, setIsTemplateSelectionPending] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [templates, effective] = await Promise.all([
        listTemplates(),
        getEffectiveTemplate(meetingId),
      ]);
      setAvailableTemplates(templates);
      setSelectedTemplate(effective.id);
      setMeetingTemplateOverrideId(effective.meetingOverrideId);
      setGlobalDefaultName(
        templates.find((template) => template.isGlobalDefault)?.name ?? effective.name,
      );
      if (effective.recoveryNotice) {
        toast.info('Template selection recovered', { description: effective.recoveryNotice });
      }
    } catch (error) {
      console.error('Failed to fetch templates:', error);
      toast.error('Could not load template selection');
    }
  }, [meetingId]);

  useEffect(() => {
    void refresh();
    window.addEventListener(TEMPLATE_CATALOG_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(TEMPLATE_CATALOG_CHANGED_EVENT, refresh);
  }, [refresh]);

  const handleTemplateSelection = useCallback(async (
    templateId: string | null,
    templateName: string,
  ) => {
    setIsTemplateSelectionPending(true);
    try {
      const effective = await setMeetingTemplateOverride(meetingId, templateId);
      setSelectedTemplate(effective.id);
      setMeetingTemplateOverrideId(effective.meetingOverrideId);
      toast.success('Template selected', {
        description: templateId ? `Using "${templateName}" for this meeting` : `Following the global default: ${effective.name}`,
      });
      Analytics.trackFeatureUsed('template_selected');
    } catch (error) {
      console.error('Failed to save meeting template:', error);
      toast.error('Could not save the meeting template');
    } finally {
      setIsTemplateSelectionPending(false);
    }
  }, [meetingId]);

  return {
    availableTemplates,
    selectedTemplate,
    meetingTemplateOverrideId,
    globalDefaultName,
    isTemplateSelectionPending,
    handleTemplateSelection,
  };
}
