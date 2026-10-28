## MODIFIED Requirements

### Requirement: Security state is readable but never writable by the assistant
The system SHALL give the assistant read-only actions for the cluster's
security state, covering users, roles, role mappings, and API key metadata, so
it can answer questions about who may reach the cluster. The system SHALL NOT
offer the assistant any action that creates, modifies, or deletes a user, a
role, a role mapping, or an API key, and SHALL NOT make such an action
available through user approval.

#### Scenario: Assistant answers a question about roles
- **WHEN** the user asks which roles grant write access to an index
- **THEN** the assistant SHALL read the cluster's roles and answer without pausing for approval

#### Scenario: Assistant is asked to create a user
- **WHEN** the user asks the assistant to create a user or grant a role
- **THEN** no such action SHALL be available to the assistant, and the assistant SHALL say the change must be made in the Security workspace

#### Scenario: A security write reaches the generic request action
- **WHEN** the assistant proposes an arbitrary request that would write to the cluster's security state
- **THEN** the system SHALL refuse it rather than presenting it for approval

#### Scenario: Assistant is asked to map a group to a role
- **WHEN** the user asks the assistant to create, change, disable, or delete a role mapping
- **THEN** no such action SHALL be available to the assistant, the generic request action SHALL refuse it, and the assistant SHALL say the change must be made in the Security workspace

## ADDED Requirements

### Requirement: Role mappings can be listed by the role they grant
The system SHALL give the assistant a read-only listing of the cluster's role
mappings, each with its name, enabled state, the roles or role templates it
grants, and its rules in full. The listing SHALL be filterable to mappings
granting a given role and searchable by name and by text in its rules, and
SHALL run without confirmation.

#### Scenario: Which groups become superuser
- **WHEN** the user asks which directory groups are given the `superuser` role
- **THEN** the assistant SHALL list only the mappings granting `superuser`, and answer from their rules without pausing for approval

#### Scenario: What a group is given
- **WHEN** the user asks what roles members of `cn=ops,ou=groups,dc=example,dc=com` receive
- **THEN** the assistant SHALL be able to search the listing by that group name and find the mappings that mention it

#### Scenario: Mappings that grant roles through templates
- **WHEN** the assistant filters by a role and a mapping grants roles only through role templates
- **THEN** the result SHALL say that template mappings cannot be matched by role and SHALL include them for the assistant to judge
