## Context

See proposal.md for motivation. What shapes the approach:

- `src/lib/store/search.js` already has everything the feature needs in pieces: `createTab(overrides)` builds a tab from the defaults, `search/tabs/add` appends one under the `MAX_TABS` cap with a notification on refusal, and `search/run` targets a tab by id and writes its outcome by id. Tab ids are minted inside `createTab`, so a caller that dispatches `search/tabs/add` does not learn the new id.
- Storeon dispatch is synchronous for plain reducers, so state written by one action is visible to the next dispatch in the same handler.
- `src/routes/search/+page.svelte` mounts a `Search.svelte` per visited tab and hides inactive ones. Results and loading state live in the store, so a tab can be running before its component exists.
- `src/lib/workspace/dashboard/indices/Cell.svelte` renders the index column as a link plus a hover-revealed copy button. The button stops propagation and prevents default so the click does not reach the row or the link. Its test mocks the clipboard and asserts on the button's class and icon.
- Navigation elsewhere uses `goto` from `$app/navigation` with `resolve` from `$app/paths`.
- The archived search-tabs design noted that a future dashboard action should reuse a pristine tab on the same index. The proposal supersedes that note: every activation opens a new tab.

## Goals / Non-Goals

**Goals:**

- One store action expresses "open this index in a tab and run it", so the dashboard component stays a dumb button and the sequencing is unit-tested next to the store.
- The new action reuses the existing cap check, tab factory, persistence and run handler instead of duplicating any of them.
- Zero changes to the Search components; the new tab arrives through the same host and store paths as a tab the user added by hand.

**Non-Goals:**

- Reusing an existing tab on the same index.
- Opening an index from anywhere other than the dashboard indices list, although the store action is generic enough for that later.
- Choosing a query other than the default for the opened tab.

## Decisions

### A composite store action owns the sequence

Add `search/tabs/open` taking `{ index }`. It mints a tab id, dispatches `search/tabs/add` with `{ id, index }` as overrides (the tab factory already accepts an id override), and then dispatches `search/run` with that id if the tab is present in the store afterwards. A refusal at the cap leaves the tab absent, so nothing runs. This reuses the cap check, refusal notification, activation and persistence of `search/tabs/add` unchanged, with no shared helper to maintain. The id is minted inside the store, so id generation does not leak to callers.

Alternatives considered:

- Dispatch `search/tabs/add` with an index override from the component, then read `activeId` from the store and dispatch `search/run`. Works today with no store change, but couples the component to the fact that add activates the new tab, and spreads a three-step sequence across a UI file where it is harder to test.
- Have the component mint an id and pass it as an override. Explicit, but leaks id generation out of the store for no gain.

### The action does not navigate

`search/tabs/open` is a store action and knows nothing about routes. The component dispatches it and then calls `goto(resolve('/search'))`. Dispatch returns nothing, so the component learns whether the tab was opened by reading `$search.activeId` before the dispatch and navigating only if it changed afterwards. A refusal at the cap leaves `activeId` untouched, so the user stays on the dashboard with the notification.

Alternative considered: pass a callback or navigate inside the store. Rejected because the store has no SvelteKit dependency today and the header, which also navigates, keeps that in components.

### Run before navigation

The action runs the query before the component navigates. The Search host mounts the new tab as active on arrival and finds it already loading or loaded. This is safe because `search/run` addresses the tab by id and never touches component state; it is also the same path a query takes when the user switches tabs mid-run, which the search-tabs spec already covers.

### The button mirrors the copy button

`Cell.svelte` gains a second button after the copy button with the same `copy-btn`-style class (rename the shared class to something neutral such as `cell-action` if that reads better, keeping the existing hover reveal rules), a search icon, a descriptive title, and the same `preventDefault` plus `stopPropagation` guard. The two buttons sit in the existing inline-flex wrapper, so spacing follows from the current gap.

### Title follows the index

The opened tab has `title: null`, so the tab bar shows the index name through the existing `tabTitle` rule. No new title logic.

## Risks / Trade-offs

- [User clicks open-in-search rapidly and opens many duplicate tabs] → accepted by the proposal; the twenty-tab cap bounds it, and closing a tab is one click.
- [Navigation happens even though the tab was refused] → the component navigates only when `activeId` changed across the dispatch; a store test covers the refusal leaving state untouched, and a component test covers no navigation on refusal.
- [Clicking the button follows the index link or triggers row handling] → same guard as the copy button; a component test asserts the link is not followed.
- [Component test cannot import `$app/navigation` in jsdom] → mock `$app/navigation` in the Cell test the way `$app/paths` is already resolvable; if the alias is not resolvable under vitest, mock the module by path.
- [Index names with characters that look like patterns] → the index is set verbatim on the tab, exactly as the dropdown would set it; no escaping is applied or needed.

## Migration Plan

No data or storage changes. The opened tab is persisted under the existing `searchTabs` key in the existing shape. Rollback is a revert.
