## 1. Remove the connection cap

- [x] 1.1 Delete the `if (savedConnections.length >= 10) shift()` block from the `add` handler in `src/lib/store/history.js` (pre-rename location; see 2.1) and verify no cap remains by inspecting the diff

## 2. Rename the store module

- [x] 2.1 Rename `src/lib/store/history.js` to `src/lib/store/connections.js`: rename the exported `history` function to `connections`, rename the state slice `history` -> `connections`, and rename event handlers `history/hydrate` -> `connections/hydrate`, `history/connection/add` -> `connections/add`, `history/connection/replace` -> `connections/replace`, `history/connection/delete` -> `connections/delete`, `history/connection/clear` -> `connections/clear`
- [x] 2.2 Update `src/lib/store/index.js` to import `connections` from `./connections` and register it in the `createStoreon([...])` list in place of `history`

## 3. Update consumers of the old names

- [x] 3.1 Update `src/lib/store/connection.js` to dispatch `connections/add` instead of `history/connection/add`
- [x] 3.2 Update `src/lib/components/modal/ConnectionDialog/ManageConnectionsDialog.svelte`: change `useStoreon('history', ...)` to `useStoreon('connections', ...)`, all `$history.connection` reads to `$connections.connection`, and dispatches of `history/connection/add|replace|delete` to `connections/add|replace|delete`
- [x] 3.3 Update `src/lib/components/modal/ConnectionDialog/ConnectDialog.svelte` to read `$connections.connection` instead of `$history.connection` / `$history?.connection`
- [x] 3.4 Update `src/lib/components/inputs/ConnectionSelector.svelte` to use `useStoreon('connections')` and `$connections.connection`
- [x] 3.5 Update `src/routes/+layout.svelte` to dispatch `connections/hydrate` instead of `history/hydrate`
- [x] 3.6 Update the "history store" comment in `src/lib/utils/helpers.js` to reference the `connections` store

## 4. Update tests

- [x] 4.1 Rename `src/lib/store/history.test.js` to `src/lib/store/connections.test.js`, update all event names and state keys to the new `connections` naming, remove the `'caps history at 10 entries'` test, and add a test that saving an 11th connection keeps all 11 in `store.get().connections.connection` — verify with `yarn vitest run src/lib/store/connections.test.js`
- [x] 4.2 Update `src/lib/components/modal/ConnectionDialog/ManageConnectionsDialog.svelte.test.js`, `src/lib/components/modal/ConnectionDialog/ConnectDialog.svelte.test.js`, and `src/lib/components/inputs/ConnectionSelector.svelte.test.js` for the renamed store module/events — verify with `yarn vitest run` on all three files

## 5. Verify the full change

- [x] 5.1 Run `yarn lint` and `yarn test` and confirm both pass, with `grep -rn "history" src --include=*.js --include=*.svelte` showing no remaining connection-store references (unrelated hits, if any, are expected to stay)
- [x] 5.2 Run the app (`yarn dev`), save more than 10 connections via "Manage Connections", and verify all are retained and selectable in the connection dropdown/selector after an app restart — confirmed by user; cap removal works
- [x] 5.3 Cap the sidebar connection list in `ManageConnectionsDialog.svelte` with `max-height: 440px` + `overflow-y: auto` so it scrolls instead of growing the dialog past ~10 saved connections (anticipated in design.md's "UI list length" risk) — confirmed by user
