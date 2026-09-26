## Purpose

Lets an operator view and manage the connected cluster's users, roles, and API
keys from inside Elastron, using whatever privileges their own account already
holds, and tells them plainly when the cluster will not allow an operation.

## ADDED Requirements

### Requirement: Security workspace is always reachable
The system SHALL present a Security entry in the main navigation whenever a
connection is active, regardless of whether the cluster has security enabled or
the connected account holds any security privilege. The entry SHALL lead to
surfaces for users, roles, and API keys.

#### Scenario: Cluster has security enabled and the account is privileged
- **WHEN** the user opens the Security workspace on a cluster whose security is enabled, using an account that may read users and roles
- **THEN** the system SHALL show the users, roles, and API key surfaces populated with the cluster's entries

#### Scenario: Cluster has security disabled
- **WHEN** the user opens the Security workspace on a cluster with security disabled
- **THEN** the navigation entry SHALL still be present, and the surface SHALL explain that the feature is unavailable rather than showing an empty list or a raw cluster error

### Requirement: Unavailability is reported as a plain cause
When the cluster refuses a security operation, the system SHALL tell the user
that the feature or action is not available and SHALL name the likely cause in
plain language. Recognised causes SHALL include security being disabled on the
cluster, the connected account lacking the required privilege, the cluster's
licence not covering the feature, and the target being a reserved entity. The
system SHALL NOT surface the cluster's raw transport error as the primary
message, and SHALL NOT require a separate capability or licence probe before
attempting an operation.

#### Scenario: Account lacks the privilege to manage users
- **WHEN** the user attempts to create a user with an account that does not hold the privilege to manage security
- **THEN** the system SHALL report that the action is not available because the account lacks the required privilege

#### Scenario: Licence does not cover document-level security
- **WHEN** the user saves a role carrying a document query or field restrictions on a cluster whose licence does not include them
- **THEN** the system SHALL report that the feature is not available because the cluster's licence does not cover document- and field-level security, and SHALL NOT report it as a permission problem

#### Scenario: Security is disabled on the cluster
- **WHEN** a security request is refused because the cluster has security disabled
- **THEN** the system SHALL report that security is not enabled on this cluster, and SHALL NOT show the cluster's method-not-allowed or no-handler error text as the message

#### Scenario: Reading one surface fails while another succeeds
- **WHEN** the account may manage its own API keys but may not read users or roles
- **THEN** the API key surface SHALL work, and each of the other surfaces SHALL independently report why it is unavailable

### Requirement: Users can be listed and managed
The system SHALL list the users the cluster reports, showing at least each
user's name, assigned roles, and enabled state. For users the cluster permits
modifying, the system SHALL allow creating a user, editing its roles, full
name, email, and metadata, changing its password, and enabling or disabling it.
Deleting a user SHALL require explicit confirmation naming the user.

#### Scenario: Creating a user
- **WHEN** the user supplies a name, a password, and a set of roles, and saves
- **THEN** the system SHALL create the user on the cluster and show it in the list

#### Scenario: Disabling a user
- **WHEN** the user disables a listed account
- **THEN** the account SHALL show as disabled without being deleted

#### Scenario: Deleting a user
- **WHEN** the user deletes an account and confirms the prompt naming it
- **THEN** that account SHALL be removed and no other account SHALL be affected

#### Scenario: Cancelling a delete
- **WHEN** the user dismisses the delete confirmation
- **THEN** no account SHALL be changed

### Requirement: Roles can be listed and managed
The system SHALL list the roles the cluster reports and SHALL allow creating
and editing roles that are not reserved. The editor SHALL support cluster
privileges, one or more index privilege entries each with index name patterns,
index privileges, a document query and field restrictions, and run-as targets.
The editor SHALL also offer a direct editing mode for the role's full
definition, so role fields the structured editor does not model can still be
set. Deleting a role SHALL require explicit confirmation naming the role.

#### Scenario: Creating a role with index privileges
- **WHEN** the user names a role, selects cluster privileges, adds an index entry with patterns and privileges, and saves
- **THEN** the system SHALL create the role on the cluster and show it in the list

#### Scenario: Editing a role field the structured editor does not model
- **WHEN** the user switches the role editor to its direct editing mode and supplies a definition containing fields outside the structured form
- **THEN** the system SHALL send that definition to the cluster as given

#### Scenario: Round-tripping an unmodelled role
- **WHEN** the user opens an existing role whose definition contains fields the structured editor does not model, and saves without touching them
- **THEN** those fields SHALL be preserved on the cluster unchanged

### Requirement: A list in progress says so
While a security list is being retrieved and has nothing to show yet, the
system SHALL indicate that the retrieval is in progress and SHALL NOT state
that the cluster holds no entries. While a list that already has entries on
screen is being retrieved again, the system SHALL keep showing the entries and
SHALL indicate the refresh separately. A retrieval that completes quickly
SHALL NOT produce a visible flash of the in-progress indication.

#### Scenario: First load of a large list
- **WHEN** the user opens a security surface and the cluster has not yet answered
- **THEN** the surface SHALL indicate that it is loading, and SHALL NOT display an empty-list message

#### Scenario: The cluster genuinely holds no entries
- **WHEN** the retrieval completes and the cluster reported no entries of that type
- **THEN** the surface SHALL display the empty-list message rather than continuing to indicate loading

#### Scenario: Refreshing a list already on screen
- **WHEN** the user refreshes a list that is already showing entries
- **THEN** the existing entries SHALL remain visible during the refresh

#### Scenario: A fast load
- **WHEN** a retrieval completes within a short delay
- **THEN** the list SHALL appear without a visible loading indication having flashed

### Requirement: Large lists stay responsive and complete
Each security list SHALL remain usable when the cluster holds a large number of
entries, and SHALL render without the number of entries degrading scrolling,
searching, or sorting. Each list SHALL represent every entry the cluster
reports for that entity type, including reserved entries, and SHALL NOT omit a
class of entry as a side effect of how it retrieves them. Search and sort
SHALL apply across the whole list, not only the portion currently on screen.

#### Scenario: A cluster with many roles
- **WHEN** the user opens the roles surface on a cluster holding several hundred roles
- **THEN** the list SHALL render and scroll smoothly, and searching SHALL match roles anywhere in the list rather than only those currently rendered

#### Scenario: Reserved entries are present in the list
- **WHEN** the cluster holds both reserved and non-reserved users
- **THEN** both SHALL appear in the users list

#### Scenario: Sorting spans the whole list
- **WHEN** the user sorts a list by a column
- **THEN** the ordering SHALL be computed over every entry the cluster reported, and the first entry shown SHALL be the first in that ordering

### Requirement: An index block's restrictions are edited in the block
The system SHALL allow the document query and the field restrictions of an
index privilege entry to be read and edited within that entry, without moving
to the role's full definition. A role may restrict several index patterns
differently, and the full definition makes it the user's job to find the right
entry among them.

Field restrictions SHALL be editable as the fields granted and the fields
excepted.

The system SHALL preserve a query it does not model, such as a templated query,
presenting it as unchangeable here rather than offering an edit that would
rewrite it. Opening a role and saving it without touching a block's
restrictions SHALL leave them exactly as the cluster reported them.

#### Scenario: Editing the query of one block among several
- **WHEN** a role restricts two index patterns with different queries and the user edits the second block's query
- **THEN** the change SHALL be made in that block, and the other block's query SHALL be unchanged

#### Scenario: A query the cluster stores as a string
- **WHEN** the user opens a block whose query the cluster reported as a JSON string
- **THEN** the query SHALL be presented as structured JSON rather than as a quoted string

#### Scenario: A query the editor does not model
- **WHEN** the user opens a block whose query is a template
- **THEN** the block SHALL say the query cannot be changed there and SHALL point at the full definition, and saving SHALL send the query back exactly as it came

#### Scenario: Removing a restriction
- **WHEN** the user clears a block's query or its field restrictions
- **THEN** that field SHALL be absent from the saved role rather than sent as empty

#### Scenario: A block with no restrictions
- **WHEN** the user adds an index block and does not give it a query or field restrictions
- **THEN** the saved role SHALL carry neither for that block

### Requirement: A restriction is checked before it silently denies access
When the cluster refuses a role because of its query, the system SHALL report
what the cluster said about that query, identifying the block it came from.

Where the connected account is permitted to, the system SHALL offer to report
how many documents a block's query matches across that block's index patterns.
This SHALL be offered as help, not as a condition of saving: when the account
may not read those indices, the system SHALL omit it without presenting the
refusal as an error, and saving SHALL remain available.

#### Scenario: A query the cluster rejects
- **WHEN** the user saves a role whose second block carries a malformed query
- **THEN** the system SHALL report the cluster's reason and SHALL identify which block it concerns

#### Scenario: Previewing what a query exposes
- **WHEN** the user asks what a block's query matches and the account may read those indices
- **THEN** the system SHALL report how many documents match across the block's patterns

#### Scenario: An account that may manage security but not read the data
- **WHEN** the user opens a block's query with an account that cannot read the indices it covers
- **THEN** the preview SHALL be absent and nothing SHALL be reported as an error, and the role SHALL still be saveable

### Requirement: Privilege choices come from the cluster
The system SHALL obtain the set of selectable cluster, index, and remote
cluster privilege names from the connected cluster rather than from a list
built into the application, so that the choices always match the cluster's own
version.

#### Scenario: Cluster offers a privilege the application predates
- **WHEN** the connected cluster reports a privilege name that did not exist when the application was built
- **THEN** that privilege SHALL be selectable in the role editor

### Requirement: API keys can be listed, created, and invalidated
The system SHALL list API keys the connected account is permitted to see,
showing at least each key's name, owner, creation time, expiry, and whether it
has been invalidated. The system SHALL allow creating a key with a name, an
optional expiry, and optional role restrictions, and SHALL allow invalidating a
key. Invalidating SHALL require explicit confirmation naming the key.

Elasticsearch offers no way to delete an API key, so the system SHALL NOT
present invalidation as a deletion, and SHALL make clear that an invalidated
key is cleared by the cluster on its own schedule rather than by the user.

#### Scenario: Creating a key
- **WHEN** the user creates a key with a name and an expiry
- **THEN** the system SHALL create it and present the generated secret once, stating that it cannot be retrieved again

#### Scenario: The secret is shown only at creation
- **WHEN** the user returns to the API key list after creating a key
- **THEN** the list SHALL NOT show that key's secret

#### Scenario: Invalidating a key
- **WHEN** the user invalidates a key and confirms the prompt naming it
- **THEN** that key SHALL show as invalidated

#### Scenario: Invalidated keys are out of the way by default
- **WHEN** the user opens the API keys surface on a cluster holding both live and invalidated keys
- **THEN** only the live keys SHALL be listed, and the surface SHALL say how many invalidated keys are hidden and why they cannot be removed

#### Scenario: Asking to see invalidated keys
- **WHEN** the user chooses to include invalidated keys
- **THEN** they SHALL be listed alongside the live ones, each marked as invalidated

#### Scenario: Invalidation is not presented as deletion
- **WHEN** the user is offered the action that invalidates a key, or confirms it
- **THEN** the wording and the control SHALL describe revoking the key rather than deleting it, and SHALL state that the cluster clears it later

#### Scenario: Account may see only its own keys
- **WHEN** the connected account may manage only its own API keys
- **THEN** the surface SHALL list that account's keys and SHALL indicate that it is showing only the account's own keys

### Requirement: Reserved entities are presented as read-only
The system SHALL identify users and roles the cluster marks as reserved and
SHALL NOT offer operations on them that the cluster forbids. For a reserved
user the system SHALL offer only a password change and, where permitted,
enabling or disabling. For a reserved role the system SHALL offer only viewing.

#### Scenario: Viewing a reserved role
- **WHEN** the user opens a role the cluster marks as reserved
- **THEN** the system SHALL show its definition, SHALL mark it as reserved, and SHALL NOT offer to edit or delete it

#### Scenario: Reserved user offers only a password change
- **WHEN** the user opens a reserved account
- **THEN** the system SHALL mark it as reserved and SHALL NOT offer to delete it or change its roles

### Requirement: The connected account cannot lock itself out
The system SHALL refuse to submit a change that would remove the connected
account's own ability to manage security or to reach the cluster. This SHALL
cover deleting the account the connection authenticates as, and removing that
account's own security-managing roles or privileges. The refusal SHALL happen
in the application, and SHALL NOT depend on the cluster rejecting the change.

#### Scenario: Deleting your own account
- **WHEN** the user attempts to delete the account the current connection authenticates as
- **THEN** the system SHALL refuse, SHALL explain that it would lock the user out of the cluster, and SHALL NOT send the request

#### Scenario: Removing your own managing role
- **WHEN** the user edits the account the current connection authenticates as so that it would no longer hold any role granting management of security
- **THEN** the system SHALL refuse to save and SHALL explain that the change would remove the user's own access

#### Scenario: Acting on a different account
- **WHEN** the user makes the same change to an account other than the one the connection authenticates as
- **THEN** the system SHALL allow it

### Requirement: Credentials never reach the application log
The system SHALL NOT write passwords, password hashes, or API key secrets to
any application log or diagnostic output, including when a security request
fails and its error is logged.

#### Scenario: A user creation fails
- **WHEN** a request that creates a user with a password is rejected by the cluster and the failure is logged
- **THEN** the logged record SHALL NOT contain the password
