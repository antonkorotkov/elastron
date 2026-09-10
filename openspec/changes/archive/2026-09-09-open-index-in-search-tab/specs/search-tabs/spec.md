## ADDED Requirements

### Requirement: A tab can be opened for a given index

Beside the tab bar's add control, the system SHALL offer a way to open a tab for a named index. Opening a tab for an index SHALL append a new tab that uses the default search configuration except that its index is the named one, SHALL make that tab active, and SHALL run its query at once so the tab shows the index's documents without further input. The new tab SHALL have no user-set title, so its title follows the index.

#### Scenario: Tab opened for an index

- **WHEN** a tab is opened for the index `products` while fewer tabs than the limit are open
- **THEN** a new tab is appended whose index is `products` and whose remaining configuration is the default
- **AND** the new tab is active and its title reads `products`
- **AND** the query runs and the tab shows the documents of `products` once the response arrives

#### Scenario: Tab opened while the limit is reached

- **WHEN** a tab is opened for an index while the limit number of tabs is open
- **THEN** no tab is added, no query runs, and the active tab is unchanged
- **AND** a notification explains that the tab limit was reached

#### Scenario: Opening the same index twice

- **WHEN** a tab is opened for the index `products` and a tab on `products` already exists
- **THEN** a second, separate tab on `products` is appended and becomes active
- **AND** the existing tab's configuration and results are unchanged

#### Scenario: Opened tab is persisted like any other

- **WHEN** a tab is opened for an index and the application restarts
- **THEN** the tab is restored with its index and default configuration, and no results
