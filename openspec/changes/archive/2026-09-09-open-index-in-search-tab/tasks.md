## 1. Store action

- [x] 1.1 In `src/lib/store/search.js`, factor the cap check, notification, append and activate steps of `search/tabs/add` into a module-private helper that both `search/tabs/add` and the new action share, and verify the existing `search/tabs/add` cases in `search.test.js` still pass
- [x] 1.2 Add `search/tabs/open` taking `{ index }`: build the tab with `createTab({ index })`, append and activate it through the shared helper, persist, then dispatch `search/run` with the new tab's id; verify a test shows the appended tab has the given index, default config otherwise, null title, is active, and that the run request was issued for that tab
- [x] 1.3 Cover refusal at the cap for `search/tabs/open`: verify a test shows no tab added, `activeId` unchanged, no search request made, and the limit notification emitted
- [x] 1.4 Cover duplicates and persistence: verify a test shows opening an index that an existing tab already uses appends a second tab and leaves the first untouched, and that the persisted `searchTabs` payload includes the new tab's index

## 2. Dashboard button

- [x] 2.1 In `src/lib/workspace/dashboard/indices/Cell.svelte`, add an open-in-search icon button after the copy button using the same hover-reveal styling, a search icon and a descriptive title, with the same `preventDefault` and `stopPropagation` guard; verify by hovering an index cell in the running app that both buttons appear side by side in the same style
- [x] 2.2 Wire the button to dispatch `search/tabs/open` with the cell's index, then call `goto(resolve('/search'))` only when `activeId` changed across the dispatch; verify a `Cell.svelte.test.js` case that clicking the button dispatches the action with the index and navigates, and a case that navigation is skipped when the store leaves `activeId` unchanged
- [x] 2.3 Verify a `Cell.svelte.test.js` case that the click does not follow the index link, and that the existing copy and health cases still pass

## 3. Verification

- [x] 3.1 Run `yarn test` and `yarn lint` and confirm both pass
- [x] 3.2 In the running app, from the dashboard click open-in-search on an index and confirm the Search view opens on a new tab titled with the index, the index control shows it, and its documents load without pressing run; then repeat on the same index and confirm a second tab appears
- [x] 3.3 In the running app, open twenty tabs and click open-in-search on the dashboard; confirm the limit notification appears, the view stays on the dashboard, and the search tabs are unchanged
- [x] 3.4 Restart the app and confirm the opened tab is restored with its index and no results
