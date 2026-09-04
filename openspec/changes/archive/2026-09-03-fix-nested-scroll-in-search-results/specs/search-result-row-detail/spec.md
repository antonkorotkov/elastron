## Purpose

Defines how an expanded row in the search results Table view presents a document — its flattened fields and its raw JSON — and how that panel stays bounded without capturing the user's scroll gesture.

## ADDED Requirements

### Requirement: Row detail introduces no scroll region

The expanded row detail panel SHALL NOT create a scrollable region of its own. Neither the field table nor the raw JSON block SHALL declare a fixed or maximum height paired with an overflow value that produces a scrollbar. The results table's scroll container SHALL remain the only scroller in the results area, so a pointer gesture anywhere over the results — including over an expanded row — scrolls the results list for the full duration of that gesture.

#### Scenario: Flicking over an expanded row scrolls the results list

- **WHEN** a row is expanded and the user performs a trackpad or wheel scroll gesture with the pointer over the expanded detail panel
- **THEN** the results list scrolls for the whole gesture, including its momentum phase
- **AND** no scroll delta from that gesture is discarded by an inner scroll container

#### Scenario: Detail panel grows with its content

- **WHEN** the expanded detail panel renders content taller than the viewport
- **THEN** the panel grows to its content's height rather than clipping it behind an inner scrollbar
- **AND** the content is reached by scrolling the results list

### Requirement: Field list is bounded by field count

The Table View tab SHALL render at most a fixed number of a document's flattened fields on expansion. When a document has more fields than that limit, the panel SHALL indicate how many fields are hidden and SHALL offer a control that reveals the remaining fields in place.

#### Scenario: Document within the field limit

- **WHEN** a user expands a row whose document has no more fields than the limit
- **THEN** every field is rendered
- **AND** no reveal control is shown

#### Scenario: Document exceeding the field limit

- **WHEN** a user expands a row whose document has more fields than the limit
- **THEN** only the first N fields are rendered, N being the limit
- **AND** a control is shown stating how many further fields exist

#### Scenario: Revealing the remaining fields

- **WHEN** the user activates the reveal control on a truncated field list
- **THEN** all remaining fields are rendered in the same panel
- **AND** the reveal control is no longer shown

#### Scenario: Metadata fields are never hidden by truncation

- **WHEN** a document is truncated because it exceeds the field limit
- **THEN** `_id`, `_index` and `_score` remain among the rendered fields

### Requirement: Raw JSON is bounded by line count

The JSON View tab SHALL render at most a fixed number of lines of a document's formatted `_source` on expansion. When the formatted JSON has more lines than that limit, the panel SHALL indicate that the output is truncated and SHALL offer a control that reveals the full JSON in place. Truncation SHALL affect only what is displayed; the copy action SHALL always copy the complete `_source` JSON.

#### Scenario: JSON within the line limit

- **WHEN** a user opens the JSON View tab for a document whose formatted JSON is no longer than the limit
- **THEN** the entire JSON is rendered
- **AND** no reveal control is shown

#### Scenario: JSON exceeding the line limit

- **WHEN** a user opens the JSON View tab for a document whose formatted JSON exceeds the limit
- **THEN** only the first N lines are rendered, N being the limit
- **AND** a control indicating that the output is truncated is shown

#### Scenario: Copying a truncated document

- **WHEN** the user activates the copy action while the JSON View is truncated
- **THEN** the complete `_source` JSON is copied, not the truncated display text

### Requirement: Truncation state is per row and per tab

Each expanded row SHALL track its own reveal state, and the Table View and JSON View tabs SHALL track theirs independently. Revealing content in one row or one tab SHALL NOT reveal content in another. Collapsing a row and expanding it again SHALL return that row to the truncated default.

#### Scenario: Revealing one row does not affect another

- **WHEN** the user reveals the hidden fields of one expanded row and then expands a second row that also exceeds the field limit
- **THEN** the second row renders truncated with its own reveal control

#### Scenario: Re-expanding resets truncation

- **WHEN** the user reveals a row's hidden fields, collapses that row, and expands it again
- **THEN** the field list is truncated again and the reveal control is shown
