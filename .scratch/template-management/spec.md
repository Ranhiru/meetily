# Template Management in Settings

Status: ready-for-agent

## Problem Statement

Meetily users can choose a summary template while generating a summary, but they cannot manage templates from Settings. The current choice is transient, resets when the meeting view remounts, and disagrees with the native summary fallback about which template is the default. Users cannot create a reusable template, customize a built-in template safely, persist one global default, or keep an intentional template override with a meeting.

The existing template model is also difficult to use directly. Templates are stored as JSON, built-in and custom files can shadow one another by internal ID, template details are not fully exposed to the frontend, and section output styles are validated but do not influence the summary prompt. Users need a safe, structured interface that preserves built-in templates, makes custom templates understandable, and applies template choices predictably without changing summaries that have already been generated.

## Solution

Add a Templates tab to Settings, positioned after Summary and before Beta. The tab presents built-in and custom templates in clearly labelled groups using a responsive list-and-editor layout. Built-in templates are immutable and can be viewed, duplicated, or selected as the global default. Custom templates can be created, viewed, edited, duplicated, renamed, selected as the global default, or permanently deleted with confirmation.

The editor exposes the existing section-based template model as structured fields rather than JSON. A template has a unique visible name, a description, and one or more ordered sections. Each section has a unique title, an instruction describing what the summary should include, an output style, and an optional advanced output pattern. Users explicitly save valid changes and are protected from losing unsaved work.

Meetily stores one global default and uses Standard Meeting as the canonical initial and recovery default. A meeting can either follow that global default dynamically or persist an explicit template override. Template changes affect only future summary generation or deliberate regeneration; existing summaries are never rewritten automatically.

## User Stories

1. As a Meetily user, I want a Templates tab in Settings, so that template management has a dedicated and discoverable home.
2. As a Meetily user, I want Templates placed next to Summary settings, so that related summary configuration is grouped together.
3. As a Meetily user, I want to see all available templates, so that I understand my summary-formatting choices.
4. As a Meetily user, I want built-in and custom templates shown in separate labelled groups, so that I can distinguish application defaults from my own work.
5. As a Meetily user, I want templates sorted alphabetically within each group, so that I can locate a template predictably.
6. As a Meetily user, I want the global default visibly marked, so that I can tell which template future summaries will use.
7. As a Meetily user, I want the current global default selected when the Templates tab opens, so that the most consequential template is immediately visible.
8. As a Meetily user, I want to inspect a built-in template without being able to overwrite it, so that application-provided templates remain reliable.
9. As a Meetily user, I want to duplicate a built-in template, so that I can customize it without changing the original.
10. As a Meetily user, I want to duplicate a custom template, so that I can create a variation without rebuilding it.
11. As a Meetily user, I want every duplicate to be an independent snapshot, so that later changes to its source do not alter my copy.
12. As a Meetily user, I want duplicate names to receive a clear unique suffix, so that I can distinguish copies immediately.
13. As a Meetily user, I want to create a template from scratch, so that I can design notes for a workflow not covered by existing templates.
14. As a Meetily user, I want a new template to begin with one incomplete starter section, so that the required structure is clear without inventing content for me.
15. As a Meetily user, I want to edit a custom template's visible name and description, so that its purpose is understandable.
16. As a Meetily user, I want renaming a template to preserve its internal identity, so that defaults and meeting overrides do not break.
17. As a Meetily user, I want template names to be unique regardless of letter case or surrounding whitespace, so that selectors never contain ambiguous labels.
18. As a Meetily user, I want to add sections to a template, so that a summary can cover every required topic.
19. As a Meetily user, I want to remove sections while keeping at least one, so that I can simplify a template without making it unusable.
20. As a Meetily user, I want to reorder sections, so that generated notes follow the order appropriate to my workflow.
21. As a Meetily user, I want each section to have a title, so that the generated summary has a meaningful structure.
22. As a Meetily user, I want each section to have an instruction, so that the model knows what content belongs there.
23. As a Meetily user, I want section titles to be unique regardless of letter case or surrounding whitespace, so that output headings and model instructions are unambiguous.
24. As a Meetily user, I want to choose Paragraph, List, or Short value as a section's output style, so that the generated content matches my intended shape.
25. As a Meetily user, I want the selected output style to influence the summary prompt, so that the control has a real effect on generation.
26. As a Meetily user, I want an optional advanced output-pattern field, so that I can request a precise Markdown table or repeated item layout.
27. As a Meetily user, I want Action Items and similar sections to preserve their structured output patterns when duplicated, so that custom copies retain useful formatting behavior.
28. As a Meetily user, I want invalid or incomplete fields explained inline, so that I know what must be corrected before saving.
29. As a Meetily user, I want saving disabled while required fields are invalid, so that unusable templates are not persisted.
30. As a Meetily user, I want an explicit Save action, so that editing does not change future summaries until I am ready.
31. As a Meetily user, I want Save and continue, Discard and continue, and Cancel choices when leaving dirty edits, so that I do not lose work accidentally.
32. As a Meetily user, I want creating or duplicating a template not to change the global default automatically, so that application behavior changes only through an intentional action.
33. As a Meetily user, I want to set any valid built-in or custom template as the global default, so that future summary generation uses my preferred structure.
34. As a Meetily user, I want Standard Meeting to be the initial default, so that the application begins with a general-purpose template.
35. As a Meetily user, I want Standard Meeting to be the recovery default, so that summary generation remains available if my chosen default disappears or becomes invalid.
36. As a Meetily user, I want the meeting template selector to offer "Use global default — <template name>" first, so that the current inherited behavior is explicit.
37. As a Meetily user, I want the meeting selector to group built-in and custom choices, so that one-off selection remains understandable.
38. As a Meetily user, I want a meeting with no explicit override to follow later global-default changes, so that the global setting remains authoritative.
39. As a Meetily user, I want to select a different template for one meeting, so that exceptional meetings can use a more suitable structure.
40. As a Meetily user, I want that explicit meeting override to survive navigation and application restarts, so that regeneration remains consistent for that meeting.
41. As a Meetily user, I want to return a meeting to "Use global default," so that it resumes following global changes.
42. As a Meetily user, I want editing a custom template to affect future generation for meetings that reference it, so that saved improvements are used consistently.
43. As a Meetily user, I want deliberate regeneration to use the latest saved version of the selected template, so that regeneration reflects my current configuration.
44. As a Meetily user, I want existing generated summaries to remain unchanged when defaults, overrides, or templates change, so that saved meeting notes are stable.
45. As a Meetily user, I want deleting a custom template to require confirmation, so that destructive actions are intentional.
46. As a Meetily user, I want deletion confirmation to identify how many meetings explicitly reference the template, so that I understand the impact.
47. As a Meetily user, I want deleting a referenced template to clear those meeting overrides, so that later generation follows the global default instead of failing.
48. As a Meetily user, I want deleting the global default to reset the default to Standard Meeting, so that the application never retains a dangling default ID.
49. As a Meetily user, I want deletion never to alter existing summaries, so that cleanup affects only future generation.
50. As a Meetily user, I want invalid global-default references recovered automatically with a visible notice, so that generation works without silently changing behavior.
51. As a Meetily user, I want invalid meeting overrides cleared automatically with a visible notice, so that the meeting safely returns to the global default.
52. As an existing Meetily user, I want legacy custom files that shadow built-ins migrated into independent custom templates, so that my work is preserved while built-ins become immutable.
53. As a Meetily user, I want loading, empty, and persistence-error states in the Templates tab, so that the interface explains what is happening.
54. As a keyboard or assistive-technology user, I want template actions, section ordering, validation, and default status to be accessible, so that I can manage templates without relying on pointer-only interactions.
55. As a privacy-conscious Meetily user, I want templates and template preferences stored locally, so that template management preserves Meetily's local-first model.
56. As a user of this fork, I want custom template management available without edition gating, so that the complete feature is usable in this application.

## Implementation Decisions

- Add Templates to the active Settings tab system immediately after Summary and before Beta. Do not integrate with the unused legacy settings-tab component.
- Build the tab as a responsive master-detail interface: a template list and action area on the left, with a structured viewer/editor on the right. Stack these areas at narrow window widths.
- Divide the list into Built-in and Custom groups and sort each group alphabetically by normalized visible name. Mark the global default in both the list and detail pane.
- Select the current global default when the tab opens. If selection becomes unavailable, select the recovered default; otherwise show a clear select-or-create empty state.
- Model template provenance explicitly. Template descriptors exposed to the frontend must identify the internal ID, visible name, description, built-in or custom origin, whether the template is the global default, and any state needed to present valid actions.
- Return the complete structured template to the editor, including ordered section titles, instructions, output styles, and optional output patterns. The existing title-only details shape is insufficient and will be replaced or versioned.
- Keep packaged and embedded built-in templates immutable. Native commands must never attempt to write application resources.
- Create every duplicate as a custom template with a newly generated, immutable internal ID. Duplicating is available for both built-in and custom sources, and the copy has no ongoing relationship to its source.
- Generate collision-free suggested copy names using a visible suffix such as "Copy" and an incrementing number. The user may rename the copy before saving, subject to uniqueness validation.
- Create a blank custom template as an unsaved draft containing a generated visible name and one incomplete section. Do not persist it until all required fields are valid and the user explicitly saves.
- Treat the internal ID as storage and reference identity, not user-facing content. Renaming changes only the visible name.
- Enforce strict internal-ID validation and path containment in the native layer. Frontend input must never become an unchecked file path.
- Perform template persistence through native commands backed by the application's local data directory. Do not expose direct arbitrary filesystem writes to the webview.
- Write custom templates atomically using a temporary file and rename operation so failed or interrupted saves do not corrupt the previous version.
- Validate and normalize all user-editable strings before persistence. Trim values for required and uniqueness checks while preserving intentional internal formatting in instructions and output patterns.
- Require a non-empty template name and description, at least one section, and a non-empty title and instruction for every section.
- Require template names to be unique case-insensitively across both built-in and custom templates after trimming whitespace.
- Require section titles to be unique case-insensitively within a template after trimming whitespace.
- Expose the existing internal output styles with user-facing labels Paragraph, List, and Short value. Persist them using the existing compatible schema values.
- Make output styles functional during prompt construction. Paragraph requests cohesive prose, List requests list-oriented output, and Short value requests one concise value. Include these effective instructions in template fingerprinting so cached summaries generated under old instructions are not reused incorrectly.
- Expose one optional advanced Output pattern field rather than separate legacy item-format aliases. Read either supported legacy key, preserve its effective value, and write the canonical item-format representation on save.
- Preserve section array order through every command and use it when constructing the output skeleton and section instructions.
- Support add, remove, and accessible reorder operations. Prevent removing the final section.
- Use explicit Save for create and edit. Maintain a draft separate from the last saved template so Cancel and Discard can restore persisted state.
- When dirty work would be abandoned by selecting another template, changing Settings tabs, navigating away, deleting, or closing the editor, offer Save and continue, Discard and continue, and Cancel. Save and continue is available only when the draft is valid.
- Built-in actions are View, Duplicate, and Set as default. Custom actions are View, Edit, Duplicate, Set as default, and Delete. No UI action exposes or edits raw JSON.
- Persist the global default in backend-owned application settings so both the frontend and native summary flow use one source of truth. Add a database migration or equivalent durable native setting rather than relying only on webview local storage.
- Establish `standard_meeting` as the canonical initial and recovery default across both frontend and native generation paths, replacing the current conflicting fallback behavior.
- Add a nullable template override reference to the durable meeting record. Null means follow the global default dynamically; a non-null ID means use that explicit template.
- Add native operations to read and update a meeting's template override. Selecting "Use global default" stores null rather than copying the current global default ID.
- Resolve the effective template when summary generation starts: valid meeting override first, then valid global default, then Standard Meeting. This applies equally to initial generation and deliberate regeneration.
- Continue to fingerprint the fully rendered template instructions as summary cache provenance. Editing an effective template must invalidate stale template-dependent cache without rewriting the saved summary.
- Do not derive the durable meeting override from generated-summary cache provenance. Cache provenance may disappear when users manually edit and save a summary and is not meeting preference state.
- Keep already-generated summary content unchanged when a template is edited, renamed, selected as default, deleted, migrated, or recovered. Only a later explicit generation or regeneration uses the resolved template.
- Before deleting a custom template, calculate and return the number of meetings with that explicit override. The confirmation communicates that impact.
- Delete a custom template and clear every matching meeting override as one coordinated operation. If it is also the global default, reset the global default to Standard Meeting. A partial operation must not leave dangling references.
- Recover invalid or missing references before generation. Reset an invalid global default to Standard Meeting; clear an invalid meeting override and use the current global default. Surface a user-visible recovery notice and log enough context for diagnosis.
- Migrate legacy custom files that share an ID with a built-in into independent custom templates with new IDs. Preserve their visible names, descriptions, sections, instructions, styles, and output patterns, then restore access to the immutable built-in. Make the migration idempotent.
- Refresh template consumers after create, update, duplicate, delete, default changes, migrations, and recovery. An already-open meeting with no override must display the latest global-default name; an explicit override remains selected until changed or cleared.
- Expose a cohesive native template-management API covering list, get full details, validate, create, duplicate, update custom, delete custom with reference cleanup, get/set global default, and legacy migration/recovery outcomes.
- Return structured error categories suitable for inline validation, conflict messaging, not-found recovery, and persistence-error notifications rather than relying on unstructured strings alone.
- Keep all template data and preferences local to the installation, consistent with Meetily's privacy-first model.
- Do not add Pro or entitlement gating in this fork.

## Testing Decisions

- Tests must assert externally observable behavior and durable state, not private helper calls, React state shape, SQL statement text, filesystem implementation details, or exact prompt wording beyond the meaning needed to prove output-style behavior.
- Use two high-level seams because the feature crosses the native and webview runtimes. The primary seam is a Rust template-management application service exercised with real temporary template storage and a temporary SQLite database. The frontend seam renders the Settings workflow and meeting selector while mocking only the native command client.
- At the Rust service seam, cover listing and grouping metadata; full-template retrieval; creation; built-in and custom duplication; custom update and rename; immutable built-in rejection; permanent deletion; reference counts; default updates; meeting override updates; and effective-template resolution.
- At the same seam, cover persistence across service reconstruction, proving that the global default and meeting overrides survive application restarts.
- Cover validation behavior for blank or whitespace-only required fields, duplicate template names with different case or whitespace, zero sections, blank section fields, duplicate section titles, unsupported output styles, malformed IDs, separators, and attempted path traversal.
- Cover atomic-update behavior by simulating a failed write and proving that the last valid custom template remains loadable.
- Cover deletion as a complete user-visible outcome: referenced meeting overrides are cleared, a deleted global default becomes Standard Meeting, unrelated meetings remain unchanged, and existing stored summaries are untouched.
- Cover effective-template precedence: explicit valid meeting override, dynamic global default when no override exists, Standard Meeting recovery for an invalid global default, and global-default recovery for an invalid meeting override.
- Cover legacy migration with a custom template that shadows a built-in. Prove that both the restored built-in and an independent migrated custom copy are available, contents are preserved, IDs differ, and repeated migration is harmless.
- Cover prompt construction behavior at the template service or summary-processing boundary. Prove that Paragraph, List, and Short value contribute distinct semantic instructions; section order is retained; output patterns are included; and effective changes alter the template fingerprint.
- Cover cache behavior through the existing summary service boundary: unchanged effective templates may reuse compatible provenance, while template edits or output-style changes invalidate stale template-dependent cache. Existing summary content remains until explicit regeneration succeeds.
- At the rendered frontend seam, cover initial selection of the global default, Built-in and Custom grouping, alphabetical presentation, default markers, read-only built-in fields, the action set for each origin, and the empty/loading/error states.
- Cover the complete create and edit workflows through user interactions: required-field errors, case-insensitive name conflicts, section add/remove/reorder, unique section-title validation, output-style selection, advanced output-pattern editing, explicit save, and persisted data after refresh.
- Cover unsaved-change protection for template selection, Settings tab changes, and navigation. Assert Save and continue, Discard and continue, and Cancel outcomes without inspecting component internals.
- Cover duplication through the UI for both origins, including independent IDs, preserved section content and order, and collision-free suggested names.
- Cover delete confirmation text and referenced-meeting count, then prove the list, default marker, and currently displayed effective meeting selection refresh after deletion.
- Cover the meeting selector with "Use global default — <name>" first and grouped template choices. Prove that selecting a named template persists an override, selecting global default clears it, and changing the global default updates only meetings without overrides.
- Cover accessible names, focus behavior, keyboard activation, and a non-pointer-only section reorder path for all interactive template controls.
- Reuse existing Rust template parsing, validation, loader, and summary-cache test patterns where they express public behavior. Expand beyond the current shallow command tests rather than duplicating equivalent cases at multiple layers.
- Reuse the frontend's existing Bun pattern for mocking native command calls. Add the smallest rendered-component test harness needed to test user interactions because the current frontend suite has no component-testing seam.
- Keep command-registration or serialization tests thin and contract-focused. The application-service and rendered-workflow seams own behavioral coverage.
- Run Rust tests, frontend unit/component tests, linting, type checking, and production builds appropriate to the touched modules before handoff.

## Out of Scope

- Raw JSON editing.
- Importing templates from JSON or other files.
- Exporting templates.
- Opening the template storage directory from the UI.
- AI-generated or deterministic template previews.
- Template version history, rollback, trash, or undo after confirmed deletion.
- Linked or inheriting duplicates that receive later source-template updates.
- Automatically changing existing generated summaries when templates or defaults change.
- Automatically making a newly created or duplicated template the global default.
- Multiple global defaults by meeting type, folder, workspace, account, or device profile.
- Cloud synchronization, sharing, collaboration, or account-scoped template storage.
- Edition, license, or Pro gating in this fork.
- Search in the first release; labelled groups and alphabetical sorting are sufficient for the current catalog. Search may be added when template counts justify it.

## Further Notes

- The supported application is the Tauri desktop app with a Rust core. The archived Python backend is not part of this feature.
- Existing templates are structured prompt recipes rather than single free-form prompts. The ordered section titles form an output skeleton, while section instructions and optional output patterns guide the model.
- The current output-style field is schema-required but not consumed during prompt construction. Making it functional is an intentional behavior correction and should be reflected in cache fingerprinting.
- Current template details expose only section titles and cannot populate the agreed editor. The native contract must expose the complete editable structure.
- Current custom-template lookup permits a custom file to shadow a built-in with the same ID. The migration in this specification intentionally replaces that behavior with immutable built-ins and independent custom copies.
- Current meeting template selection is transient and the frontend and native code disagree about the fallback. This specification establishes one backend-owned source of truth and a nullable durable per-meeting override.
- Standard Meeting is already available as an embedded fallback, making it suitable as the canonical recovery template when packaged resources are unavailable.
- No preview is required. Because model output remains nondeterministic and the current output skeleton does not render actual example content, excluding preview avoids presenting a misleading representation.
