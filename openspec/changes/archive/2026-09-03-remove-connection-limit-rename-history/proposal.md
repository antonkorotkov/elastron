## Why

The saved-connections list is capped at 10 entries via a rolling-window eviction in `history.js`, a holdover from when connections persisted through `localStorage`. Since the app moved to `electron-store` (an unbounded JSON file on disk), the cap no longer serves a purpose and silently evicts a user's oldest saved connection once they cross 10. Separately, the store module backing this list is named `history`, which reads oddly now that it's a fully user-managed list (add/edit/delete via "Manage Connections") rather than an auto-log — the name should say what it is.

## What Changes

- Remove the connection-count cap enforced in `history/connection/add`. Saved connections are no longer silently evicted once a user has more than 10.
- Rename the `history` Storeon module and its event namespace to `connections`, matching its role as the saved-connections list (distinct from the singular `connection` module, which holds the active/draft connection):
  - `history/hydrate` -> `connections/hydrate`
  - `history/connection/add` -> `connections/add`
  - `history/connection/replace` -> `connections/replace`
  - `history/connection/delete` -> `connections/delete`
  - `history/connection/clear` -> `connections/clear`
  - Store slice `state.history` -> `state.connections`
- Update all consumers of the old module/event names: `connection.js`, `ManageConnectionsDialog.svelte`, `ConnectDialog.svelte`, `ConnectionSelector.svelte`, `+layout.svelte`, and the stray comment in `helpers.js`.
- Rename `history.test.js` to `connections.test.js`; drop the "caps history at 10 entries" test and add coverage that saving an 11th+ connection is retained.

No persisted-data format changes: the electron-store key stays `'connection'` (already the on-disk key today, set via `setStorage('connection', ...)`). Only the in-memory Storeon module/event names change, so this rename carries no migration risk — existing users' saved connections load exactly as before.

## Capabilities

### New Capabilities
- `connection-management`: saved-connection storage behavior — hydrating, adding, replacing, and deleting saved connections, with no artificial cap on how many can be stored.

### Modified Capabilities
(none — no existing specs in this repo yet)

## Impact

- `src/lib/store/history.js` -> renamed to `src/lib/store/connections.js`, cap removed
- `src/lib/store/index.js` — import/registration updated
- `src/lib/store/connection.js` — dispatches updated to new event names
- `src/lib/components/modal/ConnectionDialog/ManageConnectionsDialog.svelte`
- `src/lib/components/modal/ConnectionDialog/ConnectDialog.svelte`
- `src/lib/components/inputs/ConnectionSelector.svelte`
- `src/routes/+layout.svelte`
- `src/lib/utils/helpers.js` (comment only)
- `src/lib/store/history.test.js` -> renamed to `connections.test.js`, updated
- No electron-store schema/migration changes; existing users unaffected on disk.
