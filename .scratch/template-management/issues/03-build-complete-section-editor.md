# 03: Build the complete section editor

**What to build:** Expand structured template authoring so users can control the ordered sections and the output shape that future summaries request.

**Blocked by:** 02: Create a custom template.

**Status:** resolved

- [x] Users can add, remove, and reorder sections while the editor prevents removal of the final section.
- [x] Section reordering preserves the displayed order after save and reload and includes a keyboard-accessible alternative to drag-and-drop.
- [x] Every section requires a non-empty title and instruction after trimming whitespace.
- [x] Section titles must be unique case-insensitively within the template.
- [x] Each section offers Paragraph, List, and Short value as user-facing output styles backed by the compatible stored schema values.
- [x] Paragraph requests cohesive prose, List requests list-oriented content, and Short value requests one concise value during summary generation.
- [x] Each section offers one optional advanced Output pattern field for Markdown tables or repeated item shapes.
- [x] Existing legacy output-pattern aliases load into the single effective field and saves use the canonical representation without losing behavior.
- [x] Section order, output-style instructions, and output patterns contribute to the effective template fingerprint so incompatible cached output is not reused.
- [x] Existing generated summaries remain unchanged until the user deliberately generates or regenerates a summary.
- [x] Rust tests prove prompt semantics, ordering, output-pattern compatibility, fingerprint changes, and validation; rendered tests cover accessible section authoring and persistence.
