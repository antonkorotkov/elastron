## Why

On a cluster that authenticates through LDAP or Active Directory, users never
exist in the native realm: what they may do is decided by role mappings that
turn directory groups into roles. The Security workspace manages users, roles,
and API keys but not the mappings, so the question an LDAP operator asks most
often — which group gets which role — still sends them to Kibana or `curl`.
Role mappings were explicitly left out of the first security change; this
closes that gap.

## What Changes

- Add a **Role mappings** surface to the Security workspace, between Roles and
  API keys. It lists every mapping the cluster reports with its roles, its
  rules in a readable one-line form, and whether it is enabled, searchable and
  sortable in the app.
- Create and edit mappings with a **structured editor** shaped for directory
  groups: one `all` or `any` group of field conditions on `realm.name`,
  `groups`, `username`, `dn`, or `metadata.*`, each with one or more values
  (exact, wildcard, or `/regex/`), and an optional single excepted condition.
  Roles are picked through the existing cluster-searching role picker.
- Offer a **direct editing mode** for the mapping's full definition. Rules
  deeper than the structured editor models, and role templates, are edited
  there; a mapping opened and saved without touching them keeps them exactly.
- Enable and disable a mapping from its row; delete with a confirmation naming
  it.
- Present mappings the cluster marks as read-only (defined through operator
  file-based settings) as view-only, and state that mappings from the
  `role_mapping.yml` file are not visible to this API.
- Extend the **self-lockout guard** to mappings: when the connection signs in
  through an external realm, refuse a mapping change that would take away the
  only mapping granting the account a security-managing role, and ask for
  confirmation when the app cannot tell whether a mapping applies to the
  account.
- Give the AI assistant a **read-only** role mapping listing, filterable by
  granted role. Security writes stay unavailable to it, and its refusal names
  role mappings alongside users, roles, and API keys.

Not in scope: evaluating a mapping against arbitrary users (Elasticsearch
offers no dry run), editing role templates in a structured form, listing the
cluster's configured realms, and showing on the Roles surface which mappings
grant a role.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `security-management`: the workspace gains role mappings — listing,
  creating, editing, enabling and disabling, and deleting them, read-only
  mappings, and self-lockout protection extended to changes that would remove
  the connected account's managing role by way of a mapping.
- `ai-assistant`: the assistant's read-only security state gains role
  mappings, with a listing filterable by role, and the prohibition on security
  writes names role mappings explicitly.

## Impact

- **New SvelteKit routes** under `src/routes/api/elastic/security/`: list
  (`GET _security/role_mapping`), put, and delete, all through
  `handleSecurityRequest`, so unavailability is classified the same way as the
  other surfaces. No IPC and no `main.js` changes.
- **New UI**: `src/routes/security/role-mappings/` and
  `src/lib/workspace/security/role-mappings/`; a new tab in
  `SecurityTabs.svelte`.
- **New store module** `securityRoleMappings.js` built on `createSecurityList`,
  registered in `src/lib/store/index.js`.
- **Modified**: `securityIdentity.js` keeps the authenticating realm and
  account metadata from `_authenticate`; `workspace/security/guards.js` gains
  the mapping guard; `src/lib/api/elasticsearch.js` gains the client calls;
  `src/lib/server/ai/tools/read.js`, `tools/index.js`, and `instructions.js`
  for the assistant tool and wording.
- **No Elasticsearch version branching.** The role mapping API is the same on
  the bundled 8.x and 9.x clients.
