## 1. Column layouts move to their own module

- [x] 1.1 Create a `tableConfigs` store module holding the layouts map and the `hydrate` and `update` actions currently in `search.js`, register it in `store/index.js`, and verify the moved `tableConfigs` cases from `search.test.js` pass against the new module
- [x] 1.2 Point `ResultsTable.svelte` and its test at the new slice, remove `tableConfigs` from the search slice and from the `lastSearch` omit list, and verify `yarn vitest run src/lib/workspace/search/ResultsTable.svelte.test.js` passes

## 2. Store reshape with a single tab

- [x] 2.1 Define the default tab factory, the config and result field lists, and a find-by-id helper in `search.js`; make `@init` produce `{ tabs: [defaultTab], activeId }` and verify unit tests for the factory and helper pass
- [x] 2.2 Change `search/update` to take `{ id, patch }`, ignore unknown ids, and verify tests cover updating a tab, not touching other tabs, and no-op on an unknown id
- [x] 2.3 Change `search/loading`, `search/run`, `search/documents/update`, `search/documents/reindex`, `search/documents/delete` to take a tab id and address that id on completion; verify tests where the outcome arrives after the active tab changed, and where the tab was closed before completion, land or drop correctly
- [x] 2.4 Update `Search.svelte` to receive `tab` as a prop, pass it to `SearchControls`, `EditControls`, `ProfileTable`, `ResultsTable`, and dispatch every action with `tab.id`; verify `Search.svelte.test.js` passes with a `tab` prop instead of a store mock for search data
- [x] 2.5 Update `SearchControls.svelte`, `EditControls.svelte`, `ProfileTable.svelte`, `ResultsTable.svelte` to read from the `tab` prop and dispatch with `tab.id`; verify their tests pass with the prop
- [x] 2.6 Update `Header.svelte` to reset the view on `activeId`, and `src/routes/search/+page.svelte` to render the active tab from the store; verify `yarn test` and `yarn lint` pass and the app searches exactly as before with one tab

## 3. Tab lifecycle

- [x] 3.1 Implement `search/tabs/add` with the twenty-tab cap and its notification, and verify tests cover append, activation, and refusal at the cap
- [x] 3.2 Implement `search/tabs/close` with right-neighbour then left-neighbour activation and last-tab replacement, and verify tests cover closing inactive, active with right neighbour, rightmost active, and only tab
- [x] 3.3 Implement `search/tabs/switch` and `search/tabs/rename`, with title following the index when no custom title is set and an empty rename clearing the custom title; verify tests cover each title rule
- [x] 3.4 Change the `connected` handler to clear result fields and `editDoc` in every tab, move `edit` views to `hits`, and keep index and configuration; verify tests cover a tab in edit view and a tab with results

## 4. Per-tab host and tab bar

- [x] 4.1 Rework `src/routes/search/+page.svelte` to render one `Search.svelte` per tab that has been activated at least once, keyed by id, hidden unless active, destroyed on close; verify by opening two tabs, typing invalid JSON in one, switching away and back, and seeing the text intact
- [x] 4.2 On activation, resize the Ace editor and confirm whether the virtual table's measuring action re-measures on its own; add an explicit re-measure if it does not, and verify a tab first shown after results loaded renders the table at full height
- [x] 4.3 Create `SearchTabs.svelte` with titles, per-tab loading indicator, close control, add control, and double-click rename; verify a component test covers add, close, switch, rename and the cap notification path
- [x] 4.4 Verify results routing end to end: run a slow query in tab A, switch to tab B before it returns, and confirm A shows the results and B is unchanged

## 5. Persistence and migration

- [x] 5.1 Add a debounced `searchTabs` writer with flush on window close, called from every action that changes tab configuration, title, order or active id, and never from result updates; verify tests show config changes persist and result updates do not
- [x] 5.2 Add `search/hydrate` sanitization: drop unknown fields, fill missing config from the default tab, skip malformed tabs, fall back to the first tab on unknown `activeId`, and to one default tab on an empty or missing list; verify tests for each fallback
- [x] 5.3 Implement one-time migration in `+layout.svelte`: read `searchTabs`, else wrap `lastSearch` as the single tab; verify a test where only `lastSearch` exists yields one tab with that configuration, and a manual restart with existing data restores the previous search
- [x] 5.4 Verify restart behaviour manually: three tabs with the second active are restored in order with titles and no results

## 6. Final verification

- [x] 6.1 Run `yarn test` and `yarn lint` and confirm both pass
- [x] 6.2 Walk every scenario in `specs/search-tabs/spec.md` in the running app and confirm each holds
