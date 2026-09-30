## ADDED Requirements

### Requirement: Security state is readable but never writable by the assistant
The system SHALL give the assistant read-only actions for the cluster's
security state, covering users, roles, and API key metadata, so it can answer
questions about who may reach the cluster. The system SHALL NOT offer the
assistant any action that creates, modifies, or deletes a user, a role, or an
API key, and SHALL NOT make such an action available through user approval.

#### Scenario: Assistant answers a question about roles
- **WHEN** the user asks which roles grant write access to an index
- **THEN** the assistant SHALL read the cluster's roles and answer without pausing for approval

#### Scenario: Assistant is asked to create a user
- **WHEN** the user asks the assistant to create a user or grant a role
- **THEN** no such action SHALL be available to the assistant, and the assistant SHALL say the change must be made in the Security workspace

#### Scenario: A security write reaches the generic request action
- **WHEN** the assistant proposes an arbitrary request that would write to the cluster's security state
- **THEN** the system SHALL refuse it rather than presenting it for approval

### Requirement: Credential material is never returned to the assistant
The system SHALL NOT include password hashes, API key secrets, or any other
credential material in a tool result returned to the AI provider, even when the
cluster's own response would carry it.

#### Scenario: Listing API keys
- **WHEN** the assistant reads the cluster's API keys
- **THEN** the result SHALL carry each key's name, owner, and lifecycle dates, and SHALL NOT carry any key secret

## MODIFIED Requirements

### Requirement: Read-only actions run automatically
The system SHALL execute assistant-requested actions that only read cluster state, such as listing indices, running a search, counting documents, validating a query, reading a mapping, or reading the cluster's users, roles, and API key metadata, without requiring explicit user confirmation. The one exception is fetching a page after the first of a paged listing, as defined by the Paged listings requirement.

#### Scenario: Assistant answers a question using a read action
- **WHEN** the user asks a question the assistant can answer by reading cluster state
- **THEN** the assistant SHALL perform the read and present the answer without pausing for approval

#### Scenario: Assistant reads security state
- **WHEN** the user asks a question the assistant can answer by reading the cluster's users or roles
- **THEN** the assistant SHALL perform the read and present the answer without pausing for approval
