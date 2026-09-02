# 04: Edit custom templates without losing work

**What to build:** Let users update and rename custom templates through explicit saves while protecting unsaved work during every navigation path.

**Blocked by:** 03: Build the complete section editor.

**Status:** ready-for-agent

- [ ] Selecting a custom template opens its complete structure in editable mode, while built-in templates remain read-only.
- [ ] Users can change the visible name, description, section fields, order, styles, and output patterns.
- [ ] Renaming changes only the visible name; the immutable internal ID and existing references remain stable.
- [ ] The same required-field, unique-name, and unique-section-title validation used during creation applies during editing.
- [ ] Changes remain drafts until explicit Save succeeds, and persistence failures do not replace the last saved version.
- [ ] Switching templates, switching Settings tabs, navigating away, or otherwise abandoning dirty edits offers Save and continue, Discard and continue, and Cancel.
- [ ] Save and continue is unavailable when the draft is invalid; Discard restores the last saved value; Cancel leaves the user and draft in place.
- [ ] Future generation and deliberate regeneration use the latest saved template contents, while existing generated summaries remain unchanged.
- [ ] Open template consumers refresh after a successful save without discarding unrelated meeting overrides.
- [ ] Rendered tests exercise editing and every unsaved-change outcome through user interactions; Rust integration tests prove stable identity, atomic updates, and reload behavior.
