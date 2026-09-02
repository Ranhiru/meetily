# 02: Create a custom template

**What to build:** Let users create and explicitly save a valid custom template from Settings, using safe local persistence and a simple structured draft.

**Blocked by:** 01: Show the template catalog in Settings.

**Status:** resolved

- [x] A Create template action opens an unsaved draft with a collision-free suggested name and one incomplete starter section.
- [x] The draft exposes structured fields for template name, description, section title, and section instruction; no raw JSON is exposed.
- [x] Name, description, section title, and section instruction are required after trimming whitespace.
- [x] Template names must be unique case-insensitively across built-in and custom templates.
- [x] Save remains unavailable until the draft satisfies all required validation rules, with actionable inline errors.
- [x] Explicit Save creates a custom template with a generated immutable internal ID and does not change the global default.
- [x] Native persistence constrains IDs to the template directory, rejects separators and traversal attempts, and writes atomically.
- [x] A failed save leaves any previously valid data intact and keeps the draft available for correction or retry.
- [x] The saved template appears in the Custom group and remains available after the application state is reconstructed.
- [x] Rust integration tests use temporary local storage to cover validation, ID safety, atomic persistence, and reload; rendered tests cover the complete create-and-save workflow.
