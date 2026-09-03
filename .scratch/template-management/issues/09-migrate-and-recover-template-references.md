# 09: Migrate and recover template references

**What to build:** Preserve legacy custom-template work while making built-ins immutable, and recover safely when persisted template references no longer resolve.

**Blocked by:** 07: Persist per-meeting template overrides.

**Status:** resolved

- [x] A legacy custom template that shares an internal ID with a built-in is migrated to a new independent custom-template ID.
- [x] Migration restores access to the original immutable built-in and preserves the custom template's description, sections, instructions, styles, and output patterns.
- [x] The migrated visible name is preserved when unique and receives a collision-safe copy suffix when required by the global uniqueness rule.
- [x] Migration is idempotent: running it again creates no additional copies and loses no data.
- [x] An invalid or missing global-default reference is durably reset to Standard Meeting before generation continues.
- [x] An invalid or missing meeting override is cleared and the meeting uses the current valid global default.
- [x] Every automatic migration or recovery that changes user-visible behavior produces an understandable notice and diagnostic logging.
- [x] Migration and recovery never rewrite existing generated summaries.
- [x] Template lists and open meeting selectors refresh to show migrated copies and recovered selections.
- [x] Rust integration tests cover migration, naming collisions, idempotence, both recovery paths, and summary stability; rendered tests cover the resulting notices and refreshed state.
