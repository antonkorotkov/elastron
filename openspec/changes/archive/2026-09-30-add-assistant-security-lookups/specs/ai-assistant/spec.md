## ADDED Requirements

### Requirement: Security records can be fetched by what identifies them
The system SHALL give the assistant read-only actions that fetch individual
security records by the identifiers a user or an earlier result supplies: users
by username, roles by name, and API keys by id, by name, by owning username, or
any combination of these.
Several users or several roles SHALL be fetchable in one action. A fetched role
SHALL carry its full definition, including each index entry's document query and
field restrictions. An API key lookup by name SHALL accept wildcards, and SHALL
leave out invalidated keys unless the assistant asks for them. These actions
SHALL run without confirmation, and SHALL NOT return credential material.

When some of the requested identifiers do not exist, the system SHALL return the
records that do and SHALL name the identifiers that were not found. When none
exist, it SHALL say so rather than reporting a failure.

#### Scenario: Following a user to their roles
- **WHEN** the user asks what the account `alice` may do
- **THEN** the assistant SHALL be able to fetch `alice` by username, then fetch her roles by name in a single action, and answer from their full definitions without pausing for approval

#### Scenario: A role outside the first page of the listing
- **WHEN** the cluster holds more roles than one page and the user names a role that is not on the first page
- **THEN** the assistant SHALL be able to fetch that role by its name

#### Scenario: Seeing what a role restricts
- **WHEN** the assistant fetches a role whose index entry restricts documents and fields
- **THEN** the result SHALL include that entry's document query and its granted and excepted fields

#### Scenario: Some names do not exist
- **WHEN** the assistant fetches the roles `ops` and `no_such_role`, and only `ops` exists
- **THEN** the result SHALL carry `ops` and SHALL state that `no_such_role` was not found

#### Scenario: Finding an API key by its name
- **WHEN** the user asks about the `ci-deploy` key without knowing its id
- **THEN** the assistant SHALL be able to fetch the key by that name, and the result SHALL carry its owner and lifecycle dates, its role restrictions where the cluster reports them, and SHALL NOT carry its secret

#### Scenario: A user's API keys
- **WHEN** the user asks which API keys `bob` owns
- **THEN** the assistant SHALL be able to fetch the keys by owning username, leaving out invalidated keys unless it asks for them

### Requirement: Security listings can be searched and filtered
The system SHALL let the assistant narrow each security listing to the entries
that match a search, so that it can answer from the first page without walking
the whole list. The search SHALL cover users by username, full name, email, and
role name; roles by name and description; and API keys by name and owning
username. The role listing SHALL additionally be filterable to roles granting
privileges on a given index, and to roles holding a given cluster or index
privilege, across every role the cluster holds. The API key listing SHALL leave
out invalidated keys unless the assistant asks for them.

#### Scenario: Which roles grant write on an index
- **WHEN** the user asks which roles grant `write` on `logs-2026.09` on a cluster holding thousands of roles
- **THEN** the assistant SHALL be able to list only the roles whose index entries cover that index with that privilege, drawn from every role on the cluster and not only the first page

#### Scenario: Searching users by email
- **WHEN** the user asks which account belongs to `bob@example.com`
- **THEN** the assistant SHALL be able to search the user listing by that address and find the account

#### Scenario: A search on a cluster that cannot query roles
- **WHEN** the assistant searches roles on a cluster whose version offers no role query
- **THEN** the search SHALL still match roles by name and description, without reporting the missing capability as an error

## MODIFIED Requirements

### Requirement: Paged listings
When the index listing, the user listing, the role listing, or the API key listing holds more entries than the result ceiling, the system SHALL return it one page at a time, each page stating the total number of entries and pages. The first page SHALL be fetched without confirmation. Every later page SHALL require the user's explicit approval, because each one sends another batch of cluster data to the AI provider, and the approval SHALL state which entries the page contains. Pages SHALL follow the same order, so walking them covers every entry once. A search or filter SHALL apply before paging, so the total and the pages count only the matching entries.

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
