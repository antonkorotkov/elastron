## Why

Getting from the dashboard's index list to the documents in that index takes several steps today: switch to Search, add a tab, pick the index from the dropdown, run the query. Search tabs now give each search its own home, so the dashboard can open an index in a fresh tab without disturbing anything the user has set up in Search.

## What Changes

- The index column in the dashboard indices list gains a second hover-revealed icon button next to the existing copy button, in the same style, that opens the index in Search.
- Activating it appends a new search tab preconfigured for that index with the default query, makes it the active tab, runs the query at once, and navigates to the Search view. The user lands on the new tab with the index selected and its documents loading or loaded.
- The search store gains one action that does the whole thing (create the tab, activate it, run it) so callers never have to sequence lower-level actions or learn the new tab's id.
- The tab limit applies: at the limit, nothing is opened, the existing limit notification is shown, and the view stays on the dashboard.
- Every activation opens a new tab, even when a tab on that index already exists. The archived search-tabs design recorded an intent to reuse a pristine tab; this change supersedes that note in favour of always opening a new tab.

## Capabilities

### New Capabilities

- `dashboard-index-actions`: the per-index actions offered in the dashboard indices list, currently copy-name and open-in-search, and how open-in-search hands off to the Search view.

### Modified Capabilities

- `search-tabs`: a tab can be opened preconfigured with an index and run immediately, as a second way of creating a tab beside the tab bar's add control.

## Impact

- `src/lib/store/search.js` and `search.test.js`: one new action that creates, activates and runs a tab for an index, reusing the existing tab factory, cap check and run handler.
- `src/lib/workspace/dashboard/indices/Cell.svelte` and its test: new icon button beside the copy button, dispatching the new action and navigating to `/search`.
- `openspec/specs/search-tabs/spec.md`: new requirement for opening a preconfigured tab.
- No changes to SvelteKit API routes, IPC, persistence keys, or the Search components; the new tab flows through the existing per-tab host and persistence.
