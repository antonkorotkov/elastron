## MODIFIED Requirements

### Requirement: Security workspace is always reachable
The system SHALL present a Security entry in the main navigation whenever a
connection is active, regardless of whether the cluster has security enabled or
the connected account holds any security privilege. The entry SHALL lead to
surfaces for users, roles, role mappings, and API keys.

#### Scenario: Cluster has security enabled and the account is privileged
- **WHEN** the user opens the Security workspace on a cluster whose security is enabled, using an account that may read users and roles
- **THEN** the system SHALL show the users, roles, role mappings, and API key surfaces populated with the cluster's entries

#### Scenario: Cluster has security disabled
- **WHEN** the user opens the Security workspace on a cluster with security disabled
- **THEN** the navigation entry SHALL still be present, and the surface SHALL explain that the feature is unavailable rather than showing an empty list or a raw cluster error

## ADDED Requirements

### Requirement: Role mappings can be listed and managed
The system SHALL list every role mapping the cluster reports, showing at least
its name, the roles it grants, its rules in a readable form, and whether it is
enabled, searchable by any of these. For mappings the cluster permits
modifying, the system SHALL allow creating and editing a mapping, and enabling
or disabling it. Deleting a mapping SHALL require explicit confirmation naming
it.

#### Scenario: Creating a mapping for a directory group
- **WHEN** the user names a mapping, picks the role `ops_admin`, adds a condition that `groups` equals `cn=ops,ou=groups,dc=example,dc=com`, and saves
- **THEN** the system SHALL create the mapping on the cluster and show it in the list as enabled, granting `ops_admin`

#### Scenario: Disabling a mapping
- **WHEN** the user disables a listed mapping
- **THEN** the mapping SHALL show as disabled, and its roles and rules SHALL be unchanged

#### Scenario: Deleting a mapping
- **WHEN** the user deletes a mapping and confirms the prompt naming it
- **THEN** that mapping SHALL be removed and no other mapping SHALL be affected

#### Scenario: Cancelling a delete
- **WHEN** the user dismisses the delete confirmation
- **THEN** no mapping SHALL be changed

#### Scenario: Finding the mapping for a group
- **WHEN** the user searches the list for part of a group's distinguished name
- **THEN** the mappings whose rules mention that group SHALL be shown

#### Scenario: Picking a role on a cluster with many roles
- **WHEN** the user edits a mapping's roles on a cluster holding thousands of roles and types part of a role's name
- **THEN** the system SHALL offer the matching roles from the whole cluster, and roles already granted by the mapping SHALL remain shown whether or not the search returns them

#### Scenario: Mappings the API cannot see
- **WHEN** the user opens the role mappings surface
- **THEN** the surface SHALL state that mappings defined in the cluster's role mapping files are not shown, because the cluster does not report them

### Requirement: A mapping's rules are edited as conditions
The system SHALL let the user edit a mapping's rules as one group of field
conditions that must all hold or of which any must hold. A group that must all
hold MAY also carry one condition that must not hold; Elasticsearch accepts it
nowhere else. A condition SHALL name a user field — realm name,
groups, username, distinguished name, or a metadata key — and one or more
values, each of which may be exact, a wildcard, or a regular expression.

#### Scenario: A mapping requiring a realm and one of two groups
- **WHEN** the user requires that the realm name is `ldap1` and adds a second condition that `groups` is either of two group names, choosing that all conditions must hold
- **THEN** the saved mapping SHALL grant its roles only to users of `ldap1` who belong to at least one of the two groups

#### Scenario: Excluding a group
- **WHEN** in a group whose conditions must all hold, the user adds a condition that must not hold, that `groups` equals `cn=contractors,ou=groups,dc=example,dc=com`
- **THEN** the saved mapping SHALL NOT grant its roles to members of that group

#### Scenario: An exception in a group of alternatives
- **WHEN** the user's group requires only that any condition holds
- **THEN** the system SHALL NOT offer a condition that must not hold, and SHALL say it needs a group whose conditions must all hold

#### Scenario: A wildcard or pattern value
- **WHEN** the user enters `*,ou=admins,dc=example,dc=com` or `/adm-.*/` as a value
- **THEN** the value SHALL be saved as given, and the cluster SHALL interpret it as a wildcard or regular expression respectively

#### Scenario: A mapping with no conditions
- **WHEN** the user tries to save a mapping without any condition
- **THEN** the system SHALL NOT offer to save it, and SHALL say that a mapping needs at least one condition

### Requirement: Mapping definitions the form does not model are preserved
The system SHALL offer a direct editing mode for a mapping's full definition.
Rules nested more deeply than the condition form models, and role templates,
SHALL be read and changed there. Opening a mapping and saving it without
touching such parts SHALL leave them exactly as the cluster reported them.

#### Scenario: Opening a deeply nested mapping
- **WHEN** the user opens a mapping whose rules nest one group of conditions inside another
- **THEN** the system SHALL say the rules cannot be edited as conditions and SHALL present them in the direct editing mode

#### Scenario: Round-tripping a nested mapping
- **WHEN** the user opens such a mapping, changes only its roles, and saves
- **THEN** its rules SHALL be sent back to the cluster exactly as they came

#### Scenario: A mapping that grants roles through templates
- **WHEN** the user opens a mapping that grants roles through role templates
- **THEN** the system SHALL show the templates, SHALL NOT offer the role picker for it, and SHALL point at the direct editing mode for changing them

#### Scenario: Supplying a definition directly
- **WHEN** the user switches to the direct editing mode and supplies a definition with role templates and nested rules
- **THEN** the system SHALL send that definition to the cluster as given

### Requirement: Read-only role mappings are presented as view-only
The system SHALL identify role mappings the cluster marks as read-only, such as
those defined through operator file-based settings, and SHALL offer only
viewing them: not editing, enabling or disabling, or deleting.

#### Scenario: Opening a read-only mapping
- **WHEN** the user opens a mapping the cluster marks as read-only
- **THEN** the system SHALL show its definition, SHALL mark it as read-only, and SHALL NOT offer to edit, disable, or delete it

### Requirement: Role mapping changes cannot lock the connected account out
When the connection signs in through a realm whose roles come from role
mappings, the system SHALL refuse a mapping change that would leave the account
without any enabled mapping that applies to it and grants a security-managing
role. When the system cannot tell whether a mapping applies to the account, it
SHALL warn and require confirmation. The check SHALL NOT depend on the cluster.

#### Scenario: Deleting the mapping that makes you an administrator
- **WHEN** the connection signs in as an LDAP user whose only security-managing role comes from the mapping `ldap-admins`, and the user deletes `ldap-admins`
- **THEN** the system SHALL refuse, SHALL explain that the change would lock the user out, and SHALL NOT send the request

#### Scenario: Disabling or narrowing that mapping
- **WHEN** the same user disables `ldap-admins`, removes its managing role, or changes its rules so they no longer apply to the account
- **THEN** the system SHALL refuse in the same way

#### Scenario: Another mapping still grants management
- **WHEN** the same change is made while another enabled mapping that applies to the account still grants a security-managing role
- **THEN** the system SHALL allow it

#### Scenario: A mapping that does not apply to you
- **WHEN** the user deletes a mapping whose rules do not apply to the connected account
- **THEN** the system SHALL allow it

#### Scenario: Connections whose roles do not come from mappings
- **WHEN** the connection signs in as a native, file, or reserved user, or with an API key, and the user deletes any mapping
- **THEN** the system SHALL allow it without a lockout warning

#### Scenario: The system cannot tell whether a mapping applies
- **WHEN** a change would remove a mapping that grants a managing role and whose rules depend on something the cluster does not report about the connected account
- **THEN** the system SHALL warn that the change may lock the user out and SHALL send it only after the user confirms

#### Scenario: Changing the mapping directly
- **WHEN** the user makes a change the guard refuses, but through the direct editing mode
- **THEN** the system SHALL refuse it as above
