"use client";

import { ModelConfig, ModelSettingsModal } from '@/components/ModelSettingsModal';
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogTitle,
} from "@/components/ui/dialog"
import { VisuallyHidden } from "@/components/ui/visually-hidden"
import { Button } from '@/components/ui/button';
import { ButtonGroup } from '@/components/ui/button-group';
import { Sparkles, Settings, Loader2, Square } from 'lucide-react';
import Analytics from '@/lib/analytics';
import { useState, useEffect, ReactNode } from 'react';
import type { TemplateDescriptor } from '@/types/templates';
import { MeetingTemplateSelector } from './MeetingTemplateSelector';

interface SummaryGeneratorButtonGroupProps {
  languageSlot?: ReactNode;
  modelConfig: ModelConfig;
  setModelConfig: (config: ModelConfig | ((prev: ModelConfig) => ModelConfig)) => void;
  onSaveModelConfig: (config?: ModelConfig) => Promise<void>;
  onGenerateSummary: (customPrompt: string) => Promise<void>;
  onStopGeneration: () => void;
  customPrompt: string;
  summaryStatus: 'idle' | 'processing' | 'summarizing' | 'regenerating' | 'completed' | 'error';
  availableTemplates: TemplateDescriptor[];
  meetingTemplateOverrideId: string | null;
  globalDefaultName: string;
  onTemplateSelect: (templateId: string | null, templateName: string) => Promise<void>;
  isTemplateSelectionPending: boolean;
  hasTranscripts?: boolean;
  hasSummary?: boolean;
  isModelConfigLoading?: boolean;
  onOpenModelSettings?: (openFn: () => void) => void;
}

export function SummaryGeneratorButtonGroup({
  modelConfig,
  setModelConfig,
  onSaveModelConfig,
  onGenerateSummary,
  onStopGeneration,
  customPrompt,
  summaryStatus,
  availableTemplates,
  meetingTemplateOverrideId,
  globalDefaultName,
  onTemplateSelect,
  isTemplateSelectionPending,
  hasTranscripts = true,
  hasSummary = false,
  isModelConfigLoading = false,
  onOpenModelSettings,
  languageSlot
}: SummaryGeneratorButtonGroupProps) {
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);

  // Expose the function to open the modal via callback registration
  useEffect(() => {
    if (onOpenModelSettings) {
      // Register our open dialog function with the parent by calling the callback
      // This allows the parent to store a reference to this function
      const openDialog = () => {
        console.log('📱 Opening model settings dialog via callback');
        setSettingsDialogOpen(true);
      };

      // Call the parent's callback with our open function
      // Note: This assumes onOpenModelSettings accepts a function parameter
      // We'll need to adjust the signature
      onOpenModelSettings(openDialog);
    }
  }, [onOpenModelSettings]);

  if (!hasTranscripts) {
    return null;
  }

  const isGenerating = summaryStatus === 'processing' || summaryStatus === 'summarizing' || summaryStatus === 'regenerating';

  return (
    <ButtonGroup>
      {/* Generate Summary or Stop button */}
      {isGenerating ? (
        <Button
          variant="outline"
          size="sm"
          className="bg-gradient-to-r from-red-50 to-orange-50 hover:from-red-100 hover:to-orange-100 border-red-200 px-3 gap-2"
          onClick={() => {
            Analytics.trackButtonClick('stop_summary_generation', 'meeting_details');
            onStopGeneration();
          }}
          title="Stop summary generation"
        >
          <Square size={18} fill="currentColor" />
          <span className="hidden @[24rem]:inline">Stop</span>
        </Button>
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="bg-gradient-to-r from-blue-50 to-purple-50 hover:from-blue-100 hover:to-purple-100 border-blue-200 px-3 gap-2"
          onClick={() => {
            Analytics.trackButtonClick('generate_summary', 'meeting_details');
            void onGenerateSummary(customPrompt);
          }}
          disabled={isModelConfigLoading || isTemplateSelectionPending}
          title={
            isModelConfigLoading
              ? 'Loading model configuration...'
              : isTemplateSelectionPending
                ? 'Saving template selection...'
              : hasSummary ? 'Regenerate AI Summary' : 'Generate AI Summary'
          }
        >
          {isModelConfigLoading || isTemplateSelectionPending ? (
            <>
              <Loader2 className="animate-spin" size={18} />
              <span className="hidden @[24rem]:inline">Processing...</span>
            </>
          ) : (
            <>
              <Sparkles size={18} />
              <span className="hidden @[24rem]:inline">{hasSummary ? 'Regenerate Summary' : 'Generate Summary'}</span>
            </>
          )}
        </Button>
      )}

      {languageSlot}

      {/* Settings button */}
      <Dialog open={settingsDialogOpen} onOpenChange={setSettingsDialogOpen}>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            title="Summary Settings"
          >
            <Settings />
            <span className="hidden @[40rem]:inline">AI Model</span>
          </Button>
        </DialogTrigger>
        <DialogContent
          aria-describedby={undefined}
        >
          <VisuallyHidden>
            <DialogTitle>Model Settings</DialogTitle>
          </VisuallyHidden>
          <ModelSettingsModal
            onSave={async (config) => {
              await onSaveModelConfig(config);
              setSettingsDialogOpen(false);
            }}
            modelConfig={modelConfig}
            setModelConfig={setModelConfig}
            skipInitialFetch={true}
            layout="dialog"
          />
        </DialogContent>
      </Dialog>

      <MeetingTemplateSelector
        templates={availableTemplates}
        meetingOverrideId={meetingTemplateOverrideId}
        globalDefaultName={globalDefaultName}
        onSelect={onTemplateSelect}
        disabled={isTemplateSelectionPending}
      />
    </ButtonGroup>
  );
}
