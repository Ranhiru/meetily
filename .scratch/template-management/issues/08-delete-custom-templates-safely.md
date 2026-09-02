# 08: Delete custom templates safely

**What to build:** Let users permanently delete custom templates with clear impact information and coordinated cleanup of defaults and meeting overrides.

**Blocked by:** 04: Edit custom templates without losing work; 07: Persist per-meeting template overrides.

**Status:** ready-for-agent

- [ ] Delete is available only for custom templates; built-in templates cannot be deleted through the UI or native API.
- [ ] Before confirmation, the user sees that deletion is permanent and how many meetings explicitly reference the template.
- [ ] Cancel leaves the template, global default, meeting overrides, and summaries unchanged.
- [ ] Confirmed deletion removes the custom template and clears every meeting override that references it.
- [ ] If the deleted template is the global default, the global default becomes Standard Meeting.
- [ ] Affected meetings subsequently resolve the current global default and visibly show Use global default.
- [ ] Existing generated summaries for affected meetings remain unchanged until explicit regeneration.
- [ ] Template deletion, default recovery, and override cleanup behave as one coordinated operation and do not leave dangling references after a failure.
- [ ] The Settings list and any open meeting selectors refresh after successful deletion.
- [ ] Rust integration tests cover reference counting, cleanup, fallback, failure safety, and summary stability; rendered tests cover confirmation, cancellation, and refreshed user-visible state.
