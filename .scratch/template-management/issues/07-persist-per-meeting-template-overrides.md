# 07: Persist per-meeting template overrides

**What to build:** Let each meeting either follow the global default dynamically or persist one explicit template override for future generation and regeneration.

**Blocked by:** 06: Set and resolve the global default.

**Status:** resolved

- [x] Meeting persistence gains a nullable template override reference; null means Use global default.
- [x] The meeting selector shows `Use global default — <current template name>` first, followed by labelled Built-in and Custom groups.
- [x] Selecting a named template saves its internal ID as the meeting override and survives navigation and application restarts.
- [x] Selecting Use global default clears the override instead of copying the current global-default ID.
- [x] Meetings without overrides display and resolve later global-default changes, including while their view is already open.
- [x] Meetings with explicit overrides remain on those templates when the global default changes.
- [x] Initial generation and deliberate regeneration resolve an explicit valid override before the global default.
- [x] An explicit override uses the latest saved version of its referenced template during later generation.
- [x] Persisting, changing, or clearing an override never modifies the meeting's existing generated summary.
- [x] Rust integration tests cover durable override precedence and null inheritance; rendered tests cover grouped selection, persistence, dynamic default labels, and clearing the override.
