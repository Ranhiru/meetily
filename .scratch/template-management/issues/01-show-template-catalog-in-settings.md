# 01: Show the template catalog in Settings

**What to build:** Add a read-only Templates tab that lets users inspect the complete template catalog and establishes the end-to-end native and rendered-UI seams needed by later template-management work.

**Blocked by:** None (can start immediately).

**Status:** resolved

- [x] Templates appears immediately after Summary and before Beta in the active Settings interface.
- [x] The tab uses a responsive list-and-detail layout that stacks cleanly at narrow window widths.
- [x] Built-in and custom templates are shown in clearly labelled groups and sorted alphabetically by normalized visible name.
- [x] Selecting a template displays its name, description, ordered section titles, instructions, output styles, and optional output patterns.
- [x] Template descriptors identify whether each template is built-in or custom, and built-in details are visibly read-only.
- [x] Standard Meeting is selected when the tab first opens until durable global-default selection is introduced.
- [x] Loading, empty, selection-loss, and native persistence-error states are understandable and accessible.
- [x] A cohesive native read API returns catalog metadata and complete template details without exposing filesystem paths.
- [x] Existing template listing and summary generation continue to work unchanged.
- [x] Rust service tests cover catalog and full-detail behavior, and rendered frontend tests cover grouping, selection, responsive states, and accessible read-only presentation.
