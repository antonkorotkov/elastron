## Why

The Search view holds exactly one search configuration. Any action that needs to run a query against a different index, whether the user's own or a future "open this index" shortcut from the dashboard, has to overwrite the query the user is working on, and that overwritten draft is what gets persisted for the next launch. Tabs give each search configuration its own home, so several drafts can coexist and later features can open a search without touching anything the user has set up.

## What Changes

- The Search view gains a tab bar. Each tab is an independent search configuration: search type, index, query, paging, sort, source and doc-type options, explain and profiling flags, and the selected results view.
- Each tab owns its own results, response, aggregations, profile, stats, loading state and document-being-edited. Running a query in one tab never affects another, including when the user switches tabs while that query is in flight.
- Tabs stay alive between switches. A tab's editors, scroll position, expanded rows and any half-typed request body survive switching away and back.
- Tabs can be added, closed, switched and renamed. Closing the last tab leaves a fresh default tab. A cap limits how many tabs can be open.
- Tab configuration persists across restarts and the active tab is restored. Results are never persisted. An existing single persisted search is migrated into the first tab.
- On a new connection, every tab keeps its index and configuration but drops its results.
- **BREAKING** (internal): the `search` store slice changes shape from a flat configuration to a tab list with an active tab id. Every consumer of `$search` and every `search/*` action is updated. Column layouts (`tableConfigs`) move out of the search slice into their own store module, keyed by index and shared across tabs.

## Capabilities

### New Capabilities

- `search-tabs`: what a search tab is, how tabs are created, closed, switched and renamed, how each tab isolates its configuration and results, what is persisted and restored, and how tabs react to a connection change.

### Modified Capabilities

None. The `search-result-row-detail` spec describes behaviour inside a results table and is unchanged; the table now lives inside a tab but its requirements do not move.

## Impact

- `src/lib/store/search.js` and its tests: reshaped to tabs; new actions for add, close, switch, rename; every async handler addresses a tab by id.
- New store module for column layouts, registered in `src/lib/store/index.js`; `ResultsTable` and its tests read layouts from it.
- `src/lib/workspace/search/Search.svelte`, `SearchControls.svelte`, `EditControls.svelte`, `ProfileTable.svelte`, `ResultsTable.svelte` and their tests: receive the tab as a prop and dispatch against its id.
- New tab bar component and a per-tab host in `src/routes/search/+page.svelte`.
- `src/routes/+layout.svelte`: hydrates the tab list instead of `lastSearch`, with migration from the old key.
- `src/lib/header/Header.svelte`: its pre-dialog view reset targets the active tab.
- Persisted storage: new `searchTabs` key; `lastSearch` read once for migration.
