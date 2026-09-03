## Context

See proposal.md - Why. `deleteConnection()` in `ManageConnectionsDialog.svelte` is the only place in the app that can delete a saved connection (`connections/delete` is dispatched from nowhere else). It's currently unconditional: clicking "Delete" removes the selected entry immediately.

## Goals / Non-Goals

**Goals:**
- Gate the existing `connections/delete` dispatch behind a confirmation the user must explicitly accept.
- Match the confirmation style already used everywhere else in the app for destructive actions.

**Non-Goals:**
- No change to what happens when the deleted connection is the one currently in use — the live session is unaffected either way (see design's Risks below for why this is deliberately out of scope).
- No new modal infrastructure.

## Decisions

- **Use `window.confirm()`, not a themed in-app dialog.** Every other destructive action in the codebase — deleting an index, wiping an index, deleting an alias, deleting a document, deleting a playground template (`Index.svelte` x2, `AliasTableCell.svelte`, `Search.svelte`, `TemplateDrawer.svelte`) — uses the native `confirm()`. Matching it keeps connection deletion consistent with the rest of the app's destructive-action UX, and needs no new code beyond the guard itself.
  - Alternative considered: a themed modal reusing the app's `Modal.svelte`/`getContext('modal-window')` system. Rejected for this change because `Modal.svelte` is a single-slot host (`open()` replaces whatever is currently shown) rather than a stack — layering a confirm dialog over the already-open `ManageConnectionsDialog` would require either a second modal host or open/close choreography to restore the underlying dialog afterward. That's real new infrastructure disproportionate to a one-line confirmation, and would also break the app-wide consistency of using `confirm()` for destructive actions.
- **Name the connection in the prompt.** `Index.svelte`'s `destructiveTarget()` already establishes precedent for naming the specific target in a delete prompt when ambiguity is costly; a long, uncapped saved-connections list is exactly that situation. The message reuses the same label already shown in the sidebar: `conn.name || conn.host + (conn.port ? ':' + conn.port : '')`.
- **No special-casing the active connection.** Deleting the saved profile for the connection currently in use does not disconnect or otherwise affect the live session — it only removes the saved entry. This mirrors how `connections/delete` already behaves and keeps the confirmation prompt's wording uniform regardless of which entry is selected.

## Risks / Trade-offs

- **[Native dialog can't be theme-styled]** `confirm()` always renders as the OS-native dialog, ignoring the app's dark/light theme. → Mitigation: none needed — this is the same trade-off already accepted by the six existing call sites; introducing a themed exception here for connections only would be the actual inconsistency.
- **[`confirm()` blocks the render thread]** Synchronous by design. → Mitigation: none needed — the existing call sites demonstrate this is a non-issue in Electron's renderer for a short user decision.
