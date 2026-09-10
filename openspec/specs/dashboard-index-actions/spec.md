# Dashboard Index Actions Specification

## Purpose

Defines the quick actions offered on each index row of the dashboard indices list, and how they hand off to other parts of the application.

## Requirements

### Requirement: Index rows offer quick actions

Each index cell in the dashboard indices list SHALL offer a copy-name action and an open-in-search action. Both actions SHALL be presented as small icon buttons after the index name, styled alike, revealed when the pointer is over the cell, and each SHALL carry a descriptive title. Activating either action SHALL NOT follow the index name link or trigger any row-level behaviour.

#### Scenario: Actions revealed on hover

- **WHEN** the pointer is over an index cell
- **THEN** the copy-name and open-in-search buttons become visible after the index name, in the same style

#### Scenario: Action click does not open the index page

- **WHEN** the user activates the open-in-search button on an index cell
- **THEN** the index detail page for that index is not opened by that click

### Requirement: Open in search shows the index's documents

Activating open-in-search on an index SHALL open a new search tab for that index, as defined by the search-tabs capability, and SHALL move the user to the Search view with that tab active. The user SHALL see the index selected in the tab's index control and the tab's query running or completed, without pressing run.

#### Scenario: Open an index in search

- **WHEN** the user activates open-in-search on the `products` row
- **THEN** the Search view is shown with a new active tab whose index control shows `products`
- **AND** the tab is loading or already shows documents from `products`

#### Scenario: Tab limit reached

- **WHEN** the user activates open-in-search while the search tab limit is reached
- **THEN** the user stays on the dashboard
- **AND** a notification explains that the tab limit was reached
- **AND** the search tabs are unchanged
