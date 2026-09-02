'use client';

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { ArrowDown, ArrowUp, Copy, FilePlus2, Pencil, Save, Star, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  createTemplate,
  deleteTemplate,
  duplicateTemplate,
  getTemplate,
  getTemplateDeletionImpact,
  getEffectiveTemplate,
  listTemplates,
  migrateLegacyTemplates,
  setGlobalTemplateDefault,
  updateTemplate,
} from '@/services/templateService';
import type {
  DeleteImpact,
  ManagedTemplate,
  TemplateDescriptor,
  TemplateDraft,
  TemplateOrigin,
  TemplateOutputStyle,
} from '@/types/templates';

export interface TemplateSettingsHandle {
  confirmNavigation: () => Promise<boolean>;
}

interface TemplateSettingsProps {
  onDirtyChange?: (dirty: boolean) => void;
}

type EditorMode = 'view' | 'edit' | 'create';

const emptySection = () => ({
  title: '',
  instruction: '',
  format: 'paragraph' as TemplateOutputStyle,
  item_format: null,
});

function normalize(value: string) {
  return value.trim().toLocaleLowerCase();
}

function draftFor(template: ManagedTemplate): TemplateDraft {
  return {
    name: template.name,
    description: template.description,
    sections: template.sections.map((section) => ({ ...section })),
  };
}

function validationErrors(
  draft: TemplateDraft | null,
  catalog: TemplateDescriptor[],
  editingId: string | null,
) {
  if (!draft) return ['No template draft'];
  const errors: string[] = [];
  if (!draft.name.trim()) errors.push('Template name is required');
  if (!draft.description.trim()) errors.push('Description is required');
  if (
    catalog.some(
      (template) => template.id !== editingId && normalize(template.name) === normalize(draft.name),
    )
  ) {
    errors.push('Template name must be unique');
  }
  if (draft.sections.length === 0) errors.push('At least one section is required');
  const titles = new Set<string>();
  draft.sections.forEach((section, index) => {
    if (!section.title.trim()) errors.push(`Section ${index + 1} title is required`);
    if (!section.instruction.trim()) errors.push(`Section ${index + 1} instruction is required`);
    const title = normalize(section.title);
    if (title && titles.has(title)) errors.push('Section titles must be unique');
    titles.add(title);
  });
  return [...new Set(errors)];
}

export const TemplateSettings = forwardRef<TemplateSettingsHandle, TemplateSettingsProps>(
  function TemplateSettings({ onDirtyChange }, ref) {
    const [catalog, setCatalog] = useState<TemplateDescriptor[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [selected, setSelected] = useState<ManagedTemplate | null>(null);
    const [draft, setDraft] = useState<TemplateDraft | null>(null);
    const [mode, setMode] = useState<EditorMode>('view');
    const [loading, setLoading] = useState(true);
    const [detailsLoading, setDetailsLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [deleteImpact, setDeleteImpact] = useState<DeleteImpact | null>(null);
    const [deletePending, setDeletePending] = useState(false);
    const continuationRef = useRef<((allowed: boolean) => void) | null>(null);
    const [confirmingNavigation, setConfirmingNavigation] = useState(false);

    const dirty = useMemo(() => {
      if (mode === 'create') return draft !== null;
      if (mode !== 'edit' || !selected || !draft) return false;
      return JSON.stringify(draft) !== JSON.stringify(draftFor(selected));
    }, [draft, mode, selected]);
    const errors = useMemo(
      () => validationErrors(draft, catalog, mode === 'create' ? null : selectedId),
      [catalog, draft, mode, selectedId],
    );
    const editable = mode === 'create' || mode === 'edit';

    useEffect(() => onDirtyChange?.(dirty), [dirty, onDirtyChange]);

    const refreshCatalog = useCallback(async (preferredId?: string) => {
      const templates = await listTemplates();
      setCatalog(templates);
      const fallback = templates.find((template) => template.isGlobalDefault)?.id
        ?? templates[0]?.id
        ?? null;
      setSelectedId((current) => {
        if (preferredId && templates.some((template) => template.id === preferredId)) {
          return preferredId;
        }
        if (current && templates.some((template) => template.id === current)) return current;
        return fallback;
      });
    }, []);

    useEffect(() => {
      let active = true;
      const load = async () => {
        setLoading(true);
        setError(null);
        try {
          const migration = await migrateLegacyTemplates();
          if (migration.migratedTemplates.length > 0) {
            toast.info('Custom templates recovered', {
              description: `${migration.migratedTemplates.length} legacy template${migration.migratedTemplates.length === 1 ? '' : 's'} restored as independent copies.`,
            });
          }
          const effective = await getEffectiveTemplate();
          if (effective.recoveryNotice) {
            toast.info('Template selection recovered', { description: effective.recoveryNotice });
          }
          if (active) await refreshCatalog(effective.id);
        } catch (loadError) {
          console.error('Failed to load templates:', loadError);
          if (active) setError('Could not load templates. Check local storage and try again.');
        } finally {
          if (active) setLoading(false);
        }
      };
      void load();
      return () => {
        active = false;
      };
    }, [refreshCatalog]);

    useEffect(() => {
      if (!selectedId) return;
      let active = true;
      setDetailsLoading(true);
      getTemplate(selectedId)
        .then((template) => {
          if (!active) return;
          setSelected(template);
          setDraft(draftFor(template));
          setMode('view');
          setError(null);
        })
        .catch((loadError) => {
          console.error('Failed to load template details:', loadError);
          if (active) setError('Could not load template details.');
        })
        .finally(() => {
          if (active) setDetailsLoading(false);
        });
      return () => {
        active = false;
      };
    }, [selectedId]);

    useEffect(() => {
      const warnBeforeUnload = (event: BeforeUnloadEvent) => {
        if (!dirty) return;
        event.preventDefault();
        event.returnValue = '';
      };
      window.addEventListener('beforeunload', warnBeforeUnload);
      return () => window.removeEventListener('beforeunload', warnBeforeUnload);
    }, [dirty]);

    const saveDraft = useCallback(async () => {
      if (!draft || errors.length > 0) return false;
      setSaving(true);
      try {
        const saved = mode === 'create'
          ? await createTemplate(draft)
          : await updateTemplate(selectedId!, draft);
        setSelected(saved);
        setDraft(draftFor(saved));
        setSelectedId(saved.id);
        setMode('view');
        await refreshCatalog(saved.id);
        toast.success('Template saved');
        return true;
      } catch (saveError) {
        console.error('Failed to save template:', saveError);
        toast.error('Could not save template', { description: String(saveError) });
        return false;
      } finally {
        setSaving(false);
      }
    }, [draft, errors.length, mode, refreshCatalog, selectedId]);

    const confirmNavigation = useCallback(() => {
      if (!dirty) return Promise.resolve(true);
      setConfirmingNavigation(true);
      return new Promise<boolean>((resolve) => {
        continuationRef.current = resolve;
      });
    }, [dirty]);

    useImperativeHandle(ref, () => ({ confirmNavigation }), [confirmNavigation]);

    const finishNavigation = (allowed: boolean) => {
      setConfirmingNavigation(false);
      continuationRef.current?.(allowed);
      continuationRef.current = null;
    };

    const selectTemplate = async (templateId: string) => {
      if (templateId === selectedId && mode !== 'create') return;
      if (!(await confirmNavigation())) return;
      setMode('view');
      setSelectedId(templateId);
    };

    const createDraft = async () => {
      if (!(await confirmNavigation())) return;
      const names = new Set(catalog.map((template) => normalize(template.name)));
      let name = 'Untitled Template';
      let suffix = 2;
      while (names.has(normalize(name))) name = `Untitled Template ${suffix++}`;
      setSelectedId(null);
      setSelected(null);
      setDraft({ name, description: '', sections: [emptySection()] });
      setMode('create');
    };

    const mutateSection = (index: number, patch: Partial<TemplateDraft['sections'][number]>) => {
      setDraft((current) => current && ({
        ...current,
        sections: current.sections.map((section, sectionIndex) =>
          sectionIndex === index ? { ...section, ...patch } : section),
      }));
    };

    const moveSection = (index: number, offset: -1 | 1) => {
      setDraft((current) => {
        if (!current) return current;
        const destination = index + offset;
        if (destination < 0 || destination >= current.sections.length) return current;
        const sections = [...current.sections];
        [sections[index], sections[destination]] = [sections[destination], sections[index]];
        return { ...current, sections };
      });
    };

    const duplicateSelected = async () => {
      if (!selectedId || !(await confirmNavigation())) return;
      try {
        const duplicate = await duplicateTemplate(selectedId);
        await refreshCatalog(duplicate.id);
        setMode('view');
        toast.success('Template duplicated');
      } catch (duplicateError) {
        toast.error('Could not duplicate template', { description: String(duplicateError) });
      }
    };

    const makeDefault = async () => {
      if (!selectedId) return;
      try {
        await setGlobalTemplateDefault(selectedId);
        await refreshCatalog(selectedId);
        toast.success('Global default updated');
      } catch (defaultError) {
        toast.error('Could not update the global default', { description: String(defaultError) });
      }
    };

    const prepareDelete = async () => {
      if (!selectedId || !(await confirmNavigation())) return;
      try {
        setDeleteImpact(await getTemplateDeletionImpact(selectedId));
        setDeletePending(true);
      } catch (deleteError) {
        toast.error('Could not inspect template references', { description: String(deleteError) });
      }
    };

    const confirmDelete = async () => {
      if (!selectedId) return;
      try {
        await deleteTemplate(selectedId);
        setDeletePending(false);
        setDeleteImpact(null);
        setSelected(null);
        setDraft(null);
        setSelectedId(null);
        await refreshCatalog();
        toast.success('Template deleted');
      } catch (deleteError) {
        toast.error('Could not delete template', { description: String(deleteError) });
      }
    };

    if (loading) return <p role="status">Loading templates…</p>;
    if (error && catalog.length === 0) return <div role="alert" className="rounded border border-red-200 bg-red-50 p-4 text-red-800">{error}</div>;

    const groups: Array<{ origin: TemplateOrigin; label: string }> = [
      { origin: 'built_in', label: 'Built-in' },
      { origin: 'custom', label: 'Custom' },
    ];

    return (
      <section aria-labelledby="template-settings-heading" className="mt-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="template-settings-heading" className="text-xl font-semibold">Summary templates</h2>
            <p className="text-sm text-gray-600">Create structured, reusable formats for future summaries.</p>
          </div>
          <button type="button" onClick={() => void createDraft()} className="inline-flex items-center gap-2 rounded bg-blue-600 px-3 py-2 text-sm text-white">
            <FilePlus2 size={16} /> Create template
          </button>
        </div>

        {error && <div role="alert" className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}

        {catalog.length === 0 && mode !== 'create' ? (
          <div className="rounded border border-dashed p-8 text-center text-gray-600">No templates are available. Create one to get started.</div>
        ) : (
          <div className="grid gap-5 lg:grid-cols-[minmax(15rem,0.8fr)_minmax(0,2fr)]">
            <nav aria-label="Template catalog" className="space-y-5 rounded border bg-white p-3">
              {groups.map((group) => {
                const templates = catalog.filter((template) => template.origin === group.origin);
                return (
                  <div key={group.origin}>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">{group.label}</h3>
                    {templates.length === 0 ? (
                      <p className="px-2 text-sm text-gray-500">None</p>
                    ) : (
                      <ul className="space-y-1">
                        {templates.map((template) => (
                          <li key={template.id}>
                            <button
                              type="button"
                              aria-current={selectedId === template.id ? 'true' : undefined}
                              aria-label={`${template.name}${template.isGlobalDefault ? ' — Default' : ''}`}
                              onClick={() => void selectTemplate(template.id)}
                              className={`w-full rounded px-3 py-2 text-left text-sm ${selectedId === template.id ? 'bg-blue-50 text-blue-800' : 'hover:bg-gray-50'}`}
                            >
                              <span className="flex items-center justify-between gap-2">
                                <span>{template.name}</span>
                                {template.isGlobalDefault && <span className="text-xs font-medium text-blue-700">Default</span>}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </nav>

            <div className="min-w-0 rounded border bg-white p-4">
              {detailsLoading ? (
                <p role="status">Loading template details…</p>
              ) : draft ? (
                <div className="space-y-5">
                  <div className="flex flex-wrap justify-between gap-2">
                    <div>
                      <p className="text-xs font-medium uppercase text-gray-500">{mode === 'create' ? 'New custom template' : selected?.origin === 'built_in' ? 'Built-in template · Read-only' : 'Custom template'}</p>
                      {catalog.find((template) => template.id === selectedId)?.isGlobalDefault && <p className="text-sm font-medium text-blue-700">Global default</p>}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {mode === 'view' && selected?.origin === 'custom' && <button type="button" onClick={() => setMode('edit')} className="inline-flex items-center gap-1 rounded border px-2 py-1 text-sm"><Pencil size={14} /> Edit</button>}
                      {mode === 'view' && selectedId && <button type="button" onClick={() => void duplicateSelected()} className="inline-flex items-center gap-1 rounded border px-2 py-1 text-sm"><Copy size={14} /> Duplicate</button>}
                      {mode === 'view' && selectedId && !catalog.find((template) => template.id === selectedId)?.isGlobalDefault && <button type="button" onClick={() => void makeDefault()} className="inline-flex items-center gap-1 rounded border px-2 py-1 text-sm"><Star size={14} /> Set as default</button>}
                      {mode === 'view' && selected?.origin === 'custom' && <button type="button" onClick={() => void prepareDelete()} className="inline-flex items-center gap-1 rounded border border-red-200 px-2 py-1 text-sm text-red-700"><Trash2 size={14} /> Delete</button>}
                    </div>
                  </div>

                  <label className="block text-sm font-medium">Template name
                    <input value={draft.name} disabled={!editable} onChange={(event) => setDraft({ ...draft, name: event.target.value })} className="mt-1 w-full rounded border px-3 py-2 disabled:bg-gray-50" />
                  </label>
                  <label className="block text-sm font-medium">Description
                    <textarea value={draft.description} disabled={!editable} onChange={(event) => setDraft({ ...draft, description: event.target.value })} className="mt-1 w-full rounded border px-3 py-2 disabled:bg-gray-50" />
                  </label>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold">Sections</h3>
                      {editable && <button type="button" onClick={() => setDraft({ ...draft, sections: [...draft.sections, emptySection()] })} className="rounded border px-2 py-1 text-sm">Add section</button>}
                    </div>
                    {draft.sections.map((section, index) => (
                      <fieldset key={index} className="space-y-3 rounded border p-3">
                        <legend className="px-1 text-sm font-medium">Section {index + 1}</legend>
                        {editable && (
                          <div className="flex justify-end gap-1">
                            <button type="button" aria-label={`Move section ${index + 1} up`} disabled={index === 0} onClick={() => moveSection(index, -1)} className="rounded border p-1 disabled:opacity-40"><ArrowUp size={14} /></button>
                            <button type="button" aria-label={`Move section ${index + 1} down`} disabled={index === draft.sections.length - 1} onClick={() => moveSection(index, 1)} className="rounded border p-1 disabled:opacity-40"><ArrowDown size={14} /></button>
                            <button type="button" disabled={draft.sections.length === 1} onClick={() => setDraft({ ...draft, sections: draft.sections.filter((_, sectionIndex) => sectionIndex !== index) })} className="rounded border border-red-200 px-2 py-1 text-xs text-red-700 disabled:opacity-40">Remove</button>
                          </div>
                        )}
                        <label className="block text-sm">Title
                          <input value={section.title} disabled={!editable} onChange={(event) => mutateSection(index, { title: event.target.value })} className="mt-1 w-full rounded border px-3 py-2 disabled:bg-gray-50" />
                        </label>
                        <label className="block text-sm">Instruction
                          <textarea value={section.instruction} disabled={!editable} onChange={(event) => mutateSection(index, { instruction: event.target.value })} className="mt-1 w-full rounded border px-3 py-2 disabled:bg-gray-50" />
                        </label>
                        <label className="block text-sm">Output style
                          <select aria-label={`Section ${index + 1} output style`} value={section.format} disabled={!editable} onChange={(event) => mutateSection(index, { format: event.target.value as TemplateOutputStyle })} className="mt-1 w-full rounded border px-3 py-2 disabled:bg-gray-50">
                            <option value="paragraph">Paragraph</option>
                            <option value="list">List</option>
                            <option value="string">Short value</option>
                          </select>
                        </label>
                        <label className="block text-sm">Output pattern <span className="text-gray-500">(optional)</span>
                          <textarea value={section.item_format ?? ''} disabled={!editable} onChange={(event) => mutateSection(index, { item_format: event.target.value || null })} className="mt-1 w-full rounded border px-3 py-2 font-mono text-xs disabled:bg-gray-50" />
                        </label>
                      </fieldset>
                    ))}
                  </div>

                  {editable && (
                    <div className="space-y-3 border-t pt-4">
                      {errors.length > 0 && <ul role="alert" className="list-disc pl-5 text-sm text-red-700">{errors.map((validationError) => <li key={validationError}>{validationError}</li>)}</ul>}
                      <div className="flex gap-2">
                        <button type="button" disabled={errors.length > 0 || saving} onClick={() => void saveDraft()} className="inline-flex items-center gap-2 rounded bg-blue-600 px-3 py-2 text-sm text-white disabled:opacity-50"><Save size={15} /> {saving ? 'Saving…' : 'Save'}</button>
                        <button type="button" onClick={() => {
                          if (selected) {
                            setDraft(draftFor(selected));
                            setMode('view');
                          } else {
                            setDraft(null);
                            setMode('view');
                            void refreshCatalog();
                          }
                        }} className="rounded border px-3 py-2 text-sm">Discard</button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-gray-600">Select a template or create a custom one.</p>
              )}
            </div>
          </div>
        )}

        {confirmingNavigation && (
          <div role="dialog" aria-modal="true" aria-labelledby="unsaved-template-title" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-md rounded bg-white p-5 shadow-xl">
              <h2 id="unsaved-template-title" className="text-lg font-semibold">Save template changes?</h2>
              <p className="mt-2 text-sm text-gray-600">You have unsaved template changes.</p>
              <div className="mt-5 flex flex-wrap justify-end gap-2">
                <button type="button" disabled={errors.length > 0 || saving} onClick={async () => finishNavigation(await saveDraft())} className="rounded bg-blue-600 px-3 py-2 text-sm text-white disabled:opacity-50">Save and continue</button>
                <button type="button" onClick={() => finishNavigation(true)} className="rounded border px-3 py-2 text-sm">Discard and continue</button>
                <button type="button" onClick={() => finishNavigation(false)} className="rounded border px-3 py-2 text-sm">Cancel</button>
              </div>
            </div>
          </div>
        )}

        {deletePending && deleteImpact && (
          <div role="alertdialog" aria-modal="true" aria-labelledby="delete-template-title" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-md rounded bg-white p-5 shadow-xl">
              <h2 id="delete-template-title" className="text-lg font-semibold">Permanently delete this template?</h2>
              <p className="mt-2 text-sm text-gray-700">{deleteImpact.referencedMeetings} meeting{deleteImpact.referencedMeetings === 1 ? '' : 's'} explicitly reference this template. Their overrides will be cleared. Existing summaries will not change.</p>
              {deleteImpact.isGlobalDefault && <p className="mt-2 text-sm text-gray-700">The global default will return to Standard Meeting.</p>}
              <div className="mt-5 flex justify-end gap-2">
                <button type="button" onClick={() => setDeletePending(false)} className="rounded border px-3 py-2 text-sm">Cancel</button>
                <button type="button" onClick={() => void confirmDelete()} className="rounded bg-red-600 px-3 py-2 text-sm text-white">Delete permanently</button>
              </div>
            </div>
          </div>
        )}
      </section>
    );
  },
);
