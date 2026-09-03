## Why

Deleting a saved connection in "Manage Connections" is a single, unconfirmed click today. Now that the saved-connections list has no upper limit (see `remove-connection-limit-rename-history`), lists are expected to grow well past the old informal cap of 10, raising the odds of clicking the wrong entry in a longer list. A confirmation step prevents an accidental, silent loss of a saved connection profile.

## What Changes

- Before removing a saved connection, prompt the user with a native `confirm()` dialog naming the connection being deleted (e.g. `Delete the connection "Production"?`), matching the existing convention used for every other destructive action in the app (index delete/wipe, alias delete, document delete, playground template delete — all six use `window.confirm()`).
- Only proceed with the `connections/delete` dispatch if the user confirms; cancelling leaves the saved-connections list untouched.
- No change to behavior when deleting the connection currently in use — the live session is unaffected either way, confirmed or cancelled.

## Capabilities

### New Capabilities
(none)

### Modified Capabilities
- `connection-management`: the "Saved connections can be edited and removed" requirement's delete behavior now requires explicit user confirmation before the deletion is applied.

## Impact

- `src/lib/components/modal/ConnectionDialog/ManageConnectionsDialog.svelte` — `deleteConnection()` gains a `confirm()` guard
- `src/lib/components/modal/ConnectionDialog/ManageConnectionsDialog.svelte.test.js` — new test coverage for confirm/cancel paths
- No store, persistence, or IPC changes — this is UI-layer only
