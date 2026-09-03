# 06: Set and resolve the global default

**What to build:** Give users one durable global default that controls future summary generation, with Standard Meeting as the authoritative initial fallback.

**Blocked by:** 02: Create a custom template.

**Status:** resolved

- [x] Settings lets users set any valid built-in or custom template as the global default.
- [x] The global default is visibly marked in the template list and detail pane and is selected when the Templates tab opens.
- [x] Setting the default is explicit; creating or duplicating a template never changes it automatically.
- [x] The selection is persisted in backend-owned application settings and survives application restarts.
- [x] Standard Meeting is used when no default has previously been saved.
- [x] Frontend and native summary generation share the same default-resolution source and no longer disagree between Standard Meeting and Daily Standup.
- [x] Starting generation without an explicit meeting override resolves the current global default at generation time.
- [x] Changing the default affects later generation but never rewrites an existing generated summary.
- [x] Open template consumers refresh their displayed global-default name after the setting changes.
- [x] Rust integration tests cover built-in and custom defaults, restart persistence, Standard Meeting initialization, and generation resolution; rendered tests cover default actions and markers.
