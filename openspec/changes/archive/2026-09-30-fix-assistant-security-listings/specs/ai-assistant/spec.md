## MODIFIED Requirements

### Requirement: Security listings can be searched and filtered
The system SHALL let the assistant narrow each security listing to the entries
that match a search, so that it can answer from the first page without walking
the whole list. The search SHALL cover users by username, full name, email, and
role name; roles by name and description; and API keys by name and owning
username. The role listing SHALL additionally be filterable to roles granting
privileges on a given index, and to roles holding a given cluster or index
privilege, across every role the cluster holds. A role's `all` SHALL count as
holding a privilege only when the privilege is of the same kind, cluster or
index, as the `all`, judged from the privilege names the cluster reports. The
API key listing SHALL leave out invalidated keys unless the assistant asks for
them.

#### Scenario: Which roles grant write on an index
- **WHEN** the user asks which roles grant `write` on `logs-2026.09` on a cluster holding thousands of roles
- **THEN** the assistant SHALL be able to list only the roles whose index entries cover that index with that privilege, drawn from every role on the cluster and not only the first page

#### Scenario: Searching users by email
- **WHEN** the user asks which account belongs to `bob@example.com`
- **THEN** the assistant SHALL be able to search the user listing by that address and find the account

#### Scenario: A search on a cluster that cannot query roles
- **WHEN** the assistant searches roles on a cluster whose version offers no role query
- **THEN** the first page SHALL still match roles by name and description, without reporting the missing capability as an error, and SHALL tell the assistant how to ask for later pages

#### Scenario: An index all is not a cluster privilege
- **WHEN** the assistant lists roles holding `manage_security`, and a role holds `all` only on one index
- **THEN** that role SHALL NOT be listed

#### Scenario: A cluster all is not an index privilege
- **WHEN** the assistant lists roles holding `write`, and a role holds cluster `all` and no index entries
- **THEN** that role SHALL NOT be listed

### Requirement: Paged listings
When the index listing, the user listing, the role listing, or the API key listing holds more entries than the result ceiling, the system SHALL return it one page at a time, each page stating the total number of entries and pages. The first page SHALL be fetched without confirmation. Every later page SHALL require the user's explicit approval, because each one sends another batch of cluster data to the AI provider, and the approval SHALL state which entries the page contains. An approved page SHALL be fetched with the request its approval showed, and SHALL NOT be replaced by a different request. Pages SHALL follow the same order, so walking them covers every entry once. A search or filter SHALL apply before paging, so the total and the pages count only the matching entries. A page beyond what the cluster can page SHALL be answered with a note saying so and how to narrow the listing, without sending a request the cluster would refuse.

#### Scenario: First page runs at once
- **WHEN** the assistant lists indices on a cluster with more indices than the ceiling
- **THEN** the system SHALL return the first page without asking, with the total and the number of pages

#### Scenario: A later page needs approval
- **WHEN** the assistant requests the second page of the index listing
- **THEN** the system SHALL ask the user first, stating that the page holds the next batch of entries and sends them to the AI provider, and SHALL NOT fetch it until the user approves

#### Scenario: Declining a later page
- **WHEN** the user declines a request for a later page
- **THEN** the system SHALL NOT fetch it, and the assistant SHALL be told the page was declined

#### Scenario: Paging a security listing
- **WHEN** the assistant lists roles on a cluster holding more roles than the ceiling
- **THEN** the system SHALL return the first page without asking, with the total and the number of pages, and a request for the second page SHALL need the user's approval

#### Scenario: Searching before paging
- **WHEN** the assistant lists roles with a search matching 12 of 7 000 roles
- **THEN** the result SHALL report a total of 12 on a single page

#### Scenario: An approved role page on a cluster without role search
- **WHEN** the user approves the second page of a role listing whose card shows the role search, on a cluster that has no role search
- **THEN** the system SHALL NOT fetch the whole role list in its place, and SHALL tell the assistant to ask for the page again reading the whole list, which its card then shows

#### Scenario: A page past the cluster's result window
- **WHEN** the assistant asks for page 201 of the API key listing, past the cluster's 10 000-entry window
- **THEN** the system SHALL answer with a note that the page cannot be fetched and that a narrower search can reach the entries, and SHALL NOT send the request
