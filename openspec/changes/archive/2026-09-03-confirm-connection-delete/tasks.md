## 1. Add the confirmation guard

- [x] 1.1 In `ManageConnectionsDialog.svelte`'s `deleteConnection()`, before dispatching `connections/delete`, call `confirm()` with a message naming the connection (`Delete the connection "${conn.name || conn.host + (conn.port ? ':' + conn.port : '')}"?`) and return early without dispatching if the user cancels
- [x] 1.2 Verify by inspection that the "New Connection..." cancel path (the `isEditingNew` branch of `deleteConnection`) is untouched — it never deletes a saved entry, so it must not gain a confirmation prompt

## 2. Update tests

- [x] 2.1 Add a test to `ManageConnectionsDialog.svelte.test.js` mocking `confirm` to return `true`, triggering delete, and asserting `connections/delete` is dispatched with the selected connection
- [x] 2.2 Add a test mocking `confirm` to return `false`, triggering delete, and asserting `connections/delete` is NOT dispatched and the selected connection remains shown
- [x] 2.3 Add a test asserting the `confirm()` message includes the connection's name (or host:port when unnamed) — verify with `yarn vitest run src/lib/components/modal/ConnectionDialog/ManageConnectionsDialog.svelte.test.js`

## 3. Verify the full change

- [x] 3.1 Run `yarn lint` and `yarn test` and confirm both pass
- [x] 3.2 Run the app (`yarn dev`), select a saved connection in Manage Connections, click Delete, and confirm a native dialog appears naming the connection; cancel it and verify the connection is still listed; delete again and accept, and verify it's removed — confirmed by user
