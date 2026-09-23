## Why

Elastron can inspect and operate a cluster's data but has no view of who may
reach it. Every user and role question today forces the operator out to Kibana
or to raw `curl`, even though the cluster exposes a complete management API and
most of it is available on a free basic licence. A connected operator who
already holds the privileges to manage users, roles, or API keys should be able
to do that work in the app they already have open.

## What Changes

- Add a top-level **Security** workspace, reachable from the header beside
  Dashboard, Monitoring, Search, and Playground. The nav entry is always
  visible; what it can do is discovered by using it.
- Add a **Users** surface: list native and reserved users, create and edit
  native users, change passwords, and enable or disable accounts.
- Add a **Roles** surface: list roles, create and edit custom roles with
  cluster privileges, index privilege blocks, and run-as, plus a raw-JSON
  escape hatch for the long tail of role fields.
- Edit an index block's document query and field restrictions **in the block
  itself**, including templated queries, rather than sending the user to the
  whole-role JSON to find the right one. Where the account is permitted to read
  the data, show how many documents the query would expose, and check a
  template renders, which the cluster does not check when the role is saved.
- Add an **API keys** surface: list keys, create a key with an optional
  expiry and role descriptors, and invalidate keys.
- Render all three lists through the app's existing virtualised table, so a
  cluster with hundreds or thousands of roles stays responsive, with search and
  sorting applied in the app rather than by the cluster.
- Show a loading indication in the list itself while a list is being retrieved,
  so a slow fetch over a remote or tunnelled connection does not read as an
  empty result or a frozen window.
- Mark reserved users and roles as read-only in the UI, and offer only the
  operations Elasticsearch actually permits on them.
- Guard against self-lockout: refuse, in the app, to let the connected account
  delete itself or remove its own security privileges.
- Surface unavailability as a plain notification rather than a capability
  matrix. When the cluster refuses an operation, tell the user the feature is
  not available and name the likely cause, such as security being disabled on
  the cluster, the account lacking a privilege, or the licence not covering
  the feature.
- Give the AI assistant **read-only** security tools so it can answer questions
  about users, roles, and keys. The assistant is never offered a security write
  tool, with or without approval.
- Redact request bodies from the shared Elasticsearch error log, so a failed
  user write cannot put a plaintext password into the application log.

Not in scope: role mappings, application privileges, service accounts, user
profiles, and cross-cluster role fields beyond what the raw-JSON editor already
allows through.

## Capabilities

### New Capabilities

- `security-management`: viewing and managing a cluster's users, roles, and API
  keys from the app, including reserved-entity handling, self-lockout
  protection, and how unavailability is reported to the user.

### Modified Capabilities

- `ai-assistant`: the assistant's read-only tool set gains cluster users,
  roles, and API key metadata, and the spec gains an explicit prohibition on
  security write tools and on returning credential material.

## Impact

- **New SvelteKit API routes** under `src/routes/api/elastic/security/**`,
  all going through the existing `handleElasticRequest` helper. No new IPC and
  no changes to `main.js`.
- **New routes and components**: `src/routes/security/**` and
  `src/lib/workspace/security/**`, following the Monitoring layout and tab
  pattern.
- **New store modules** under `src/lib/store/elasticsearch/`, registered in
  `src/lib/store/index.js`.
- **Modified**: `src/lib/header/Header.svelte` for the nav entry,
  `src/lib/server/elastic.js` for error-log redaction and for mapping security
  failures to user-facing causes, and the assistant's read tool set in
  `src/lib/server/ai/tools/read.js`.
- **No Elasticsearch version branching.** The security API is identical across
  the bundled 8.x and 9.x clients; the only observed difference is the set of
  builtin privilege names, which the app reads from the cluster at runtime.
