## Context

See proposal.md - Why. The saved-connections list currently lives in `src/lib/store/history.js`, a Storeon module named for its origin as a connect-log rather than its current role as a fully user-managed list (add/edit/delete via "Manage Connections"). Persistence already goes through `electron-store` via `setStorage('connection', ...)`; the on-disk key is `'connection'`, not `'history'`.

## Goals / Non-Goals

**Goals:**
- Remove the 10-entry cap in `history/connection/add`.
- Rename the `history` module and its event namespace to `connections`, so naming matches behavior.
- Leave the persisted electron-store schema and key untouched.

**Non-Goals:**
- No change to the shape of a stored connection object (`normalizeConnection`).
- No redesign of the Manage Connections UI or connection pickers.
- No introduction of a new soft cap or pagination — the list becomes fully unbounded.

## Decisions

- **Module/event naming: `connections` (plural)**, dropping the `history/connection/` prefix stutter down to a flat `connections/*` namespace (`connections/hydrate`, `connections/add`, `connections/replace`, `connections/delete`, `connections/clear`). This pairs naturally with the existing singular `connection` module (the active/draft connection being edited or connected). Alternative considered: `savedConnections` — more explicit, but noisier at every dispatch call site; rejected since `connection` vs `connections` is already the implicit mental model in the codebase (one active, many saved).
- **Cap removal, not a higher soft cap.** Delete the `if (savedConnections.length >= 10) shift()` block entirely rather than raising the threshold. The existing `isEqual` dedupe in `connections/add` already prevents unbounded growth from repeated identical saves, so there's no runaway-growth scenario a soft cap would guard against.
- **No persistence-layer change.** Only the in-memory Storeon module name and event strings change; `setStorage('connection', ...)` keeps writing to the same electron-store key. This makes the rename a zero-migration change — existing users' on-disk data is read and written exactly as before.

## Risks / Trade-offs

- **[UI list length]** The Manage Connections sidebar list and the connection `<select>`/dropdowns have no explicit `max-height`/scroll styling that's been verified against a long list — today that's masked by the informal 10-item cap. → Mitigation: during implementation, manually test with 15+ saved connections in `ManageConnectionsDialog.svelte` and `ConnectionSelector.svelte`; add explicit `overflow-y: auto` / `max-height` if the list overflows its container instead of scrolling.
- **[Wide mechanical rename]** Renaming touches 8 files (module, index registration, 3 components, layout, a comment, and the test file). → Mitigation: grep for remaining `history/` event strings and `$history`/`useStoreon('history')` references after the change to confirm nothing was missed; run the existing test suite, which already covers add/replace/delete/hydrate behavior.

## Migration Plan

None required. This ships as a normal code release: the persisted electron-store key (`'connection'`) and stored connection shape are unchanged, so existing users' saved connections load identically before and after the update. No data transform, version bump, or user-facing migration step is needed.
