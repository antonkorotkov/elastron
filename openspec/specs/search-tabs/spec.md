# Search Tabs Specification

## Purpose

Defines how the Search view holds several independent search configurations as tabs: what a tab contains, how tabs are created, closed, switched and renamed, how each tab keeps its own results and working state, what survives a restart, and what happens when the connection changes.

## Requirements

### Requirement: A tab is an independent search configuration

The Search view SHALL present one or more tabs. Each tab SHALL hold its own search type, index, URI query, request body, size, from, sort, source option and value, doc-type option and value, explain flag, profiling flag, and selected results view. Changing any of these in one tab SHALL NOT change them in any other tab.

#### Scenario: Edits stay in their tab

- **WHEN** the user has two tabs, changes the index and query in the first, then switches to the second
- **THEN** the second tab shows the index and query it had before, unchanged

#### Scenario: A fresh tab starts from defaults

- **WHEN** the user adds a tab
- **THEN** the new tab uses the default search configuration: URI search over all indices with a match-all query, ten results from offset zero, no sort, source and doc type disabled, explain and profiling disabled, and the hits view
- **AND** the new tab becomes the active tab

### Requirement: Each tab owns its results

Each tab SHALL hold its own results, raw response, aggregations, profile, statistics, loading state and document being edited. Running a query SHALL deliver its outcome to the tab it was started from, regardless of which tab is active when the outcome arrives.

#### Scenario: Results land in the originating tab

- **WHEN** the user runs a query in tab A, switches to tab B before the response arrives, and the response then arrives
- **THEN** tab A shows the new results and tab B's results are unchanged

#### Scenario: Errors land in the originating tab

- **WHEN** the user runs a query in tab A, switches to tab B, and the query fails
- **THEN** an error notification is shown, tab A is no longer loading, and tab B's state is unchanged

#### Scenario: Document edits target their tab

- **WHEN** the user updates or deletes a document from tab A's results and switches to tab B before the operation completes
- **THEN** on completion tab A's results reflect the change and tab B's results are unchanged

#### Scenario: Loading is per tab

- **WHEN** a query is running in tab A and the user switches to tab B
- **THEN** tab B's run control is enabled and tab A is marked as loading in the tab bar

### Requirement: Tabs keep their working state between switches

Switching away from a tab and back SHALL NOT discard the tab's working state. Working state includes the results scroll position, expanded result rows and their selected detail pane, the columns sidebar state, and the current text of the request body editor even when that text is not valid JSON.

#### Scenario: Half-typed request body survives a switch

- **WHEN** the user is in request body mode, types an incomplete JSON body, switches to another tab, and switches back
- **THEN** the request body editor shows the incomplete text exactly as it was left

#### Scenario: Expanded rows and scroll survive a switch

- **WHEN** the user expands a result row, scrolls the results, switches to another tab, and switches back
- **THEN** the same row is still expanded and the results are at the same scroll position

### Requirement: Tabs can be added up to a limit

The user SHALL be able to add a tab from the tab bar. The number of open tabs SHALL be limited. When the limit is reached, adding a tab SHALL be refused and the user SHALL be told why.

#### Scenario: Adding a tab

- **WHEN** the user activates the add control while fewer tabs than the limit are open
- **THEN** a new default tab is appended and becomes active

#### Scenario: Limit reached

- **WHEN** the user activates the add control while the limit number of tabs is open
- **THEN** no tab is added
- **AND** a notification explains that the tab limit was reached

### Requirement: The tab bar stays on one row

The tab bar SHALL keep every tab on a single row regardless of how many tabs are open or how long their titles are. When the tabs do not fit, the bar SHALL scroll horizontally, and the tab that becomes active SHALL be brought into view.

#### Scenario: More tabs than fit

- **WHEN** the open tabs are wider than the tab bar
- **THEN** the bar keeps its height, no tab wraps to a second row, and the bar can be scrolled sideways to reach the hidden tabs

#### Scenario: Activating a tab outside the visible range

- **WHEN** a tab that is scrolled out of view becomes active, whether by adding it, by closing its neighbour, or on restart
- **THEN** the bar scrolls so that tab is visible

### Requirement: Tabs can be closed

Each tab SHALL offer a close control. Closing a tab SHALL discard its configuration, results and working state. Closing the active tab SHALL activate the tab to its right, or the tab to its left when there is none to the right. Closing the last remaining tab SHALL replace it with a fresh default tab.

#### Scenario: Closing an inactive tab

- **WHEN** the user closes a tab that is not active
- **THEN** that tab is removed and the active tab is unchanged

#### Scenario: Closing the active tab with a right neighbour

- **WHEN** the user closes the active tab and a tab exists to its right
- **THEN** the tab that was to its right becomes active

#### Scenario: Closing the rightmost active tab

- **WHEN** the user closes the active tab and it is the rightmost tab
- **THEN** the tab that was to its left becomes active

#### Scenario: Closing the only tab

- **WHEN** the user closes the only open tab
- **THEN** a fresh default tab replaces it and is active

#### Scenario: Closing a loading tab

- **WHEN** the user closes a tab whose query is still running and the response later arrives
- **THEN** the response is discarded and no other tab is affected

### Requirement: Tabs have titles

A tab's title SHALL default to its index. When the index changes in a tab without a user-set title, the title SHALL follow. The user SHALL be able to rename a tab; a user-set title SHALL persist until the user clears it, after which the title follows the index again.

#### Scenario: Title follows the index

- **WHEN** a tab has no user-set title and the user selects the index `products`
- **THEN** the tab's title is `products`

#### Scenario: Renaming a tab

- **WHEN** the user renames a tab to `Recent orders` and later changes its index
- **THEN** the tab's title stays `Recent orders`

#### Scenario: Clearing a custom title

- **WHEN** the user renames a tab to an empty title
- **THEN** the tab's title follows its index again

### Requirement: Tab configuration survives a restart

The system SHALL persist every tab's configuration and title, the tab order, and which tab is active. On start it SHALL restore them. Results, responses, aggregations, profiles, statistics, loading state, documents being edited, and editor working state SHALL NOT be persisted.

#### Scenario: Tabs restored after restart

- **WHEN** the user has three tabs with different configurations, the second is active, and the application restarts
- **THEN** three tabs are shown in the same order with the same configurations and titles, and the second is active

#### Scenario: Results are not restored

- **WHEN** the user runs a query in a tab and restarts the application
- **THEN** the tab shows its configuration and no results

#### Scenario: Invalid persisted data is tolerated

- **WHEN** the persisted tab data is missing, malformed, or references an active tab that does not exist
- **THEN** the Search view starts with the tabs that could be restored, or a single default tab when none could
- **AND** the first restored tab is active when the persisted active tab is unknown

### Requirement: A previously persisted single search is migrated

When no persisted tab data exists but a persisted single search configuration from an earlier version does, the system SHALL restore it as the only tab. The migration SHALL happen at most once.

#### Scenario: Upgrade from a single search

- **WHEN** the application starts with a persisted single search configuration and no persisted tabs
- **THEN** the Search view shows one tab holding that configuration
- **AND** subsequent starts restore from the persisted tabs

### Requirement: A connection change keeps tabs and drops results

When the active connection changes, every tab SHALL keep its configuration and title and SHALL drop its results, response, aggregations, profile, statistics and document being edited. A tab in the edit view SHALL return to the hits view.

#### Scenario: Reconnect keeps configuration

- **WHEN** the user has tabs configured for several indices and connects to another cluster
- **THEN** every tab still shows its index and query, and none shows results

#### Scenario: Reconnect leaves the edit view

- **WHEN** a tab is in the document edit view and the user connects to another cluster
- **THEN** that tab shows the hits view with no document being edited

### Requirement: Column layouts are shared across tabs

Saved column layouts for the results table SHALL be keyed by index and SHALL apply in every tab that searches that index. Changing a layout in one tab SHALL be visible in another tab on the same index.

#### Scenario: Layout shared between tabs

- **WHEN** the user adds a column to the results table for index `products` in tab A and tab B is also on `products`
- **THEN** tab B's results table shows the added column

#### Scenario: Layout not shared across indices

- **WHEN** the user changes the layout for index `products` in tab A and tab B is on index `logs`
- **THEN** tab B's layout is unchanged
