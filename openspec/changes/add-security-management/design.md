## Context

See proposal.md — Why.

The approach below rests on behaviour verified against three clusters during
exploration: an Enterprise-licensed 8.19.9 cluster with real data, and two
throwaway basic-licence clusters, 8.19.9 and 9.3.4, one of which ran with
security switched off. The findings that shaped the design are recorded inline
with each decision rather than assumed.

Relevant existing constraints:

- Renderer code never talks to Elasticsearch directly. It calls SvelteKit API
  routes under `src/routes/api/elastic/**`, which own the client. This feature
  adds routes there and no IPC.
- `handleElasticRequest` in `src/lib/server/elastic.js` is the single entry
  point for every route: it resolves SSH tunnels, runs the action, closes the
  client, and shapes errors. Security routes go through it unchanged.
- Both Elasticsearch 8 and 9 clients are bundled and selected per connection by
  `createClient`.

## Goals / Non-Goals

**Goals:**

- Keep the whole feature inside the existing route, store, and workspace
  patterns, so it reads like the Monitoring area rather than a new subsystem.
- Fail informatively. Every refusal the cluster can produce maps to a sentence
  a user can act on.
- Carry no version-specific branching.

**Non-Goals:**

- Modelling every field of a role in the structured editor. The direct editing
  mode is the designed answer for the long tail, not a fallback.
- Pre-flight discovery of what the account or licence permits. This is an
  explicit design boundary, covered under Decisions.
- Server-side pagination of the users and roles lists. Investigated and
  rejected under Decisions; the lists are virtualised instead.
- Any offline or cached view of security state. Every surface reads live.

## Decisions

### Attempt the operation, then explain the refusal

The app does not probe for security being enabled, for the licence, or for the
account's privileges before offering an operation. It performs the operation
and, when the cluster refuses, reports the cause in plain language.

Alternative considered and rejected: a capability probe on connect, calling
`_security/user/_has_privileges` and `_xpack`, caching four booleans and a
licence type, and gating the UI from them. It works, and exploration confirmed
the calls behave correctly, but it buys pre-emptive greying-out at the cost of
a capability engine that has to stay correct as Elasticsearch evolves. Three
findings made the trade clearly bad:

- There is no feature flag for document- and field-level security. `_xpack`
  reports `features.security.available: true` on a basic licence, where both
  are refused. Only `license.type` predicts the refusal, so the probe would
  encode a licence-tier table.
- `_xpack` and `_license` require the `monitor` cluster privilege and returned
  403 to a no-privilege account, while `_has_privileges` returned 200 to that
  same account. The probe therefore needs its own fallback path.
- The refusals themselves are already clear and specific. The cluster says
  `current license is non-compliant for [field and document level security]`.

So the mapping table below is the whole mechanism. It is a lookup from an
error signature to a cause.

It lives in `src/lib/security/`, not under `src/lib/server/`, because both
sides need it: a route classifies the failure, and the renderer switches on the
result to choose what to show. SvelteKit refuses to bundle anything under
`$lib/server` into the browser, and the module has no dependencies of its own,
so this mirrors how `src/lib/ai/catalog.js` is shared for the same reason.

| Signature from the cluster | Cause reported to the user |
| --- | --- |
| 400 with `no handler found for uri [/_security/...]` | Security is not enabled on this cluster |
| 405 with `Incorrect HTTP method for uri [/_security/...]` | Security is not enabled on this cluster |
| 403 `security_exception`, reason mentions `license` | The cluster's licence does not cover this feature |
| 403 `security_exception`, any other reason | The account lacks the privilege this action needs |
| 400 with reason containing `is reserved` | The target is a reserved user or role and cannot be changed this way |
| 401 | The connection's credentials were rejected |

The 405 row is the one that matters most and is the least obvious. On a cluster
with security disabled, `GET /_security/user` does not report that security is
off. It returns `Incorrect HTTP method for uri [/_security/user] and method
[GET], allowed: [POST]`, which is actively misleading. Without this mapping
that string would reach the user verbatim through the existing error path.

### No Elasticsearch version branching

The security API was compared across 8.19.9 and 9.3.4 on identical basic-licence
clusters. Endpoints, status codes, and the response key sets for users, roles,
and API key creation were identical. The single difference was the builtin
privilege list: 63 cluster privileges on 9.3.4 against 62 on 8.19.9, the
addition being `monitor_esql`. Index privileges, 24, and remote cluster
privileges, 2, matched exactly.

The privilege pickers therefore read their options from
`GET /_security/privilege/_builtin` on the connected cluster at load, rather
than from a list compiled into the app. That removes the only observed
difference, so the feature needs no version switch anywhere, and it keeps
working against cluster versions released after the app.

### Fetch the full list, filter in the renderer, and virtualise the table

All three surfaces load the cluster's complete list and render it through the
existing `VirtualTable` component, with sorting and search derived in the
renderer. This is the same pattern the indices, shards, and allocation tables
already use, and it gives one code path for every supported cluster version.

Server-side pagination was investigated and rejected. Elasticsearch does offer
query endpoints for all three entity types, and `_security/_query/role` in
particular paginates properly: it honours `from` and `size`, sorts by name in
either direction, accepts a `query` filter, supports `search_after`, and returns
both a `total` and a `_sort` cursor on every row. Two findings ruled it out.

**The query endpoints do not exist across the supported version range.**
Verified against a clean 8.0.0 cluster:

| Endpoint | 8.0.0 | 8.19.9 | 9.3.4 |
| --- | --- | --- | --- |
| `GET /_security/user` | yes | yes | yes |
| `GET /_security/role` | yes | yes | yes |
| `GET /_security/api_key` | yes | yes | yes |
| `POST /_security/_query/user` | **no** | yes | yes |
| `POST /_security/_query/role` | **no** | yes | yes |
| `POST /_security/_query/api_key` | yes | yes | yes |

On 8.0.0 the user and role query endpoints answer `no handler found`. Adopting
them would mean a paged path and a fetch-all path, chosen by cluster version,
for the same two screens.

**`_query/user` silently omits reserved users, which makes it wrong regardless
of version.** On a seeded cluster holding 60 native and 7 reserved accounts,
`GET /_security/user` returned 67 and `_query/user` returned 60, with no
reserved account present in the result. The Enterprise cluster observed during
exploration has seven users and every one is reserved, so a Users screen built
on `_query/user` would show an empty list there while the cluster plainly has
accounts. `_query/role` does not share this flaw and returned all 29 reserved
roles among its 279, but it is the only one of the three that would work, so
using it buys a version-branched special case for a single surface.

Fetch-all is comfortable at observed scale. The real Enterprise cluster returned
its 148 roles, the largest payload of the three entity types because every one
carries a document query, in 297 KB and 76 ms over the local server. At roughly
2 KB per role that stays under 2 MB to a thousand roles. `VirtualTable` renders
only the visible window, so row count is not the constraint; payload size is,
and it becomes worth revisiting somewhere past a few thousand roles.

`_security/_query/role` is therefore the documented escape hatch if that day
comes, and the capability notes above record exactly what it supports so the
work does not need re-investigating.

### Loading is shown in the table body, not only on the refresh control

Because each surface loads its cluster's whole list, a slow load must not read
as an empty or frozen screen. Two states are distinguished:

- **First load, with nothing to show.** The table body shows a loading state.
  It SHALL NOT show the empty message, which would assert the cluster has no
  entries while the answer is still in flight.
- **Refresh, with rows already on screen.** The existing rows stay, and the
  refresh control shows the in-progress state via the `loading` class, matching
  the indices, shards, and allocation tables.

The indices, shards, and allocation tables currently get the first case wrong:
each passes an `emptyMessage` such as `No indices found`, and `VirtualTable`
renders it whenever the row array is empty, including throughout the initial
fetch. This change does not fix those screens, but it does not copy the flaw.

An indicator that appears for a few tens of milliseconds is worse than none, so
it is shown only once a load has been running beyond a short delay, on the order
of a couple of hundred milliseconds. Below that the list simply appears.

**No chunking, worker, or incremental render is needed.** Measurements show the
client is not where the time goes:

| Roles | Payload | Blocking work on the main thread |
| --- | --- | --- |
| 148 | 0.2 MB | 1 ms |
| 1 000 | 1.5 MB | 4 ms |
| 5 000 | 7.6 MB | 38 ms |
| 10 000 | 15.1 MB | 51 ms |

Blocking work is parse plus transform plus sort plus filter combined, and is
dominated by `JSON.parse`. Sorting and filtering ten thousand roles cost about
a millisecond each, so virtualised rendering keeps interaction cheap no matter
how long the list is.

The cluster is not the bottleneck either. A throwaway cluster seeded with 2 029
roles shaped like the real ones, three index blocks and a document query each,
returned all of them as 3.1 MB in 35 ms over the loopback interface.

What does take time is moving that payload over a real link, which matters
because the app supports remote clusters and SSH tunnels:

| Link | 3.1 MB transfer |
| --- | --- |
| LAN, 100 Mbps | 0.2 s |
| Office, 25 Mbps | 1.0 s |
| VPN, 10 Mbps | 2.4 s |
| Slow tunnel, 2 Mbps | 11.9 s |

So the indicator earns its place on exactly the case that motivated it, a large
role set on a remote cluster, and a spinner is the right and sufficient tool
because the wait is I/O, not a blocked main thread.

### Role editor: structured form with a direct editing mode

The structured form covers cluster privileges, index privilege entries, and
run-as. Everything else — applications, global, remote clusters, transient
metadata — is reachable through a direct editing mode backed by the existing
JsonEditor component.

The editor holds the role's full definition as its source of truth and applies
structured edits to it, rather than rebuilding a role from form fields on save.
Without that, opening and saving a role carrying unmodelled fields would
silently drop them. On the Enterprise cluster every one of the 116 custom roles
carries a document query, so a lossy round trip would not be a rare edge case
there, it would be the normal path.

Document queries and field restrictions are ordinary fields in the editor. They
are not hidden or pre-gated by licence. On a cluster that does not permit them
the save is refused and the licence row of the mapping table explains why.

### An index block's restrictions are edited in the block

Sending the user to the whole-role JSON to change one block's query is the
wrong shape for the task. A role commonly restricts several patterns
differently, and the Enterprise cluster seen during exploration has 116 such
roles, so finding the right entry among them is work the editor should be
doing. Each block therefore edits its own query and field restrictions.

Four findings from testing the API against a trial-licence cluster shape this.

**Every query shape is stored as a string.** An object, a JSON string and a
template all come back from the cluster as a string. The editor parses that
string to show structured JSON and sends an object back, which the cluster
accepts. A block's restrictions are held on the block exactly as the cluster
reported them until edited, so a role opened and saved untouched round-trips.

**The cluster checks a query's structure when the role is saved**, and says
something useful about it:

| Sent | Answer |
| --- | --- |
| Malformed JSON | 400, `failed to parse field 'query' for indices [logs-*] at index privilege [0]` |
| Unknown query type | 400, `unknown query [no_such_query] did you mean [rule_query]?` |
| Unknown field name | accepted |

So there is no client-side query validation to write. The reason is surfaced as
it is, with the block it came from named, because the cluster's own message
identifies the entry only by position.

**The cluster does not check a template.** A Mustache source with unbalanced
delimiters is accepted, and fails later when a user's request is evaluated, so
the role appears saved while quietly denying access. `POST /_render/template`
rejects the same source with `[1:25] Unexpected end of file`, so a template is
rendered before the role is saved and a failure stops the save. This is the one
place the app checks something the cluster would not.

**A preview is genuinely useful and not always available.** Running a block's
query as a count over its patterns answers what syntax checking cannot: a query
matching zero documents is valid and almost certainly wrong. But an account
holding only `manage_security` is refused both the count and the render, while
still being allowed to save the role. The preview is therefore offered, never
required: when it is refused the surface omits it rather than reporting a
failure, and saving is unaffected.

A templated query is edited as its own source rather than as the escaped string
the cluster stores, since that string is JSON nested inside JSON and is close to
unreadable. The block records which of the two forms it holds so the right one
is sent back.

### Reserved entities

A user or role is treated as reserved when the cluster reports
`metadata._reserved: true`. This is what the cluster itself returns and needs no
name list in the app. Exploration confirmed the resulting refusals, all 400:
editing a reserved role, deleting a reserved role, deleting a reserved user,
and changing a reserved user's roles. The UI suppresses those affordances, and
the mapping table's reserved row covers anything that slips through.

### Self-lockout is guarded in the app, because the cluster does not

Elasticsearch refuses to let an account disable itself, reporting `users may
not update the enabled status of their own account`. It does not refuse
anything else. During exploration a native account holding `superuser` stripped
its own roles using its own credentials, the cluster returned 200, and the very
next request from that account returned 403. The lockout was immediate and not
recoverable from within the app.

The guard therefore lives in the app and compares the target against the
account the active connection authenticates as, obtained from
`GET /_security/_authenticate`. This is a single call whose result identifies
the current user, and it is not the rejected capability probe: it establishes
identity, not permissions.

### API keys are a separate surface with their own outcome

Keys are not gated by the same privileges as users and roles. An account
holding only `manage_own_api_key` created and listed its own keys through
`GET /_security/api_key?owner=true`, while the unscoped key list, the user
list, and the role list all returned 403. The keys surface is therefore
independent: it requests the account's own keys when the unscoped list is
refused, and says which of the two it is showing.

A created key's secret is returned once, in the creation response, and never
again. The creation dialog presents it with a copy action and states plainly
that it cannot be retrieved later.

### Credential redaction in the shared error path

`handleElasticRequest` currently ends with `console.error("Elasticsearch Error",
err)`. Elasticsearch client errors carry `meta.meta.request.params`, which
includes the request body. Today that logs index settings. Once a security
route exists, a failed user creation would put a plaintext password into the
Electron log.

The fix is in the shared handler rather than in the security routes, so it
covers every present and future route: log a reduced record carrying the
status, the path, and the cluster's reason, and never the request body.

### Assistant tools

The assistant gains read-only actions for users, roles, and API key metadata,
added to the existing read tool set so they run without approval. No security
write tool exists, so there is nothing for an approval flow to expose, and the
generic request action refuses writes to `_security` paths. The cluster's user
API does not return password hashes and its key API does not return secrets, so
the credential prohibition in the spec is enforced by an explicit field filter
rather than relying on that remaining true.

## Risks / Trade-offs

- **An action is offered that the account cannot perform, and only fails on
  submit.** → Accepted deliberately; it is the cost of dropping the capability
  probe. Mitigated by the mapping table making every refusal specific about the
  cause, and by the surface reporting its read failure up front, so a user
  without read access sees the explanation before reaching for a button.
- **The direct editing mode lets a user save a role the structured form cannot
  re-open faithfully.** → The editor keeps the full definition as its source of
  truth and applies structured edits onto it, so unmodelled fields survive. A
  round-trip test over a role carrying a document query and application
  privileges covers this.
- **Fetch-all does not scale to a cluster with thousands of roles.** → Row count
  is handled by virtualisation; the constraint is payload size. Observed scale is
  148 roles in 297 KB and 76 ms, and roughly 2 KB per role thereafter.
  `_query/role` is the documented escape hatch, and the decision above records
  what it supports so adopting it later needs no re-investigation.
- **Rejecting `_query/user` means the Users list is always fetched whole.** →
  Accepted. That endpoint omits reserved accounts entirely, so paging with it
  would hide the very accounts that are the only ones present on some clusters.
  User counts are also far smaller than role counts: 67 users came back in
  9 KB against 297 KB of roles.
- **Listing users and roles sends account names, emails, and metadata to the AI
  provider when the assistant reads them.** → The existing assistant spec
  already governs what leaves the app, and the assistant is only ever invoked
  deliberately. Credential material is filtered out regardless.
- **A self-lockout guard keyed to the authenticated account will not catch
  every route to the same outcome**, such as deleting a role the current
  account depends on. → The guard covers the direct cases, deleting your own
  account and removing your own managing roles. Indirect privilege removal is
  out of reach without evaluating role graphs, and is left to the cluster.

## Migration Plan

Additive throughout. New routes, new store modules, one new workspace, and one
new navigation entry. The two edits to existing files, the header entry and the
error-log redaction in `handleElasticRequest`, are independent of the rest and
carry no data migration. Rollback is removing the navigation entry.

## Open Questions

- Whether the roles table should offer a filter for roles carrying a document
  query. The Enterprise cluster suggests it would be useless there, since all
  116 custom roles carry one, and useful on a mixed cluster. Deferrable: it
  changes no requirement and no route.
