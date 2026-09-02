# 05: Duplicate any template

**What to build:** Let users turn any built-in or custom template into an independent custom snapshot that can be changed without affecting its source.

**Blocked by:** 02: Create a custom template.

**Status:** resolved

- [x] Duplicate is available from both built-in and custom template actions.
- [x] The duplicate receives a newly generated immutable internal ID and is stored as a custom template.
- [x] Name, description, ordered sections, instructions, output styles, and output patterns are copied exactly.
- [x] The suggested visible name is unique case-insensitively and uses a predictable Copy, Copy 2, and later suffix sequence.
- [x] The duplicate has no link to its source and does not receive later source-template updates.
- [x] Editing or deleting the duplicate cannot alter the source template.
- [x] Creating a duplicate does not make it the global default.
- [x] The new custom template appears in the correct alphabetical position and becomes selected for inspection or editing.
- [x] Rust integration tests cover both origins, independent identity, complete field preservation, and collision naming; rendered tests cover both duplicate actions and resulting state.
