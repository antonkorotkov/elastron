## Context

See proposal.md for motivation. The requirements are in
`specs/ai-assistant/spec.md`.

Relevant current state:

- Tools are defined in two places that must agree. `src/lib/ai/catalog.js`
  holds each tool's approval policy and builds the request it sends, so the
  approval card shows exactly what runs. `src/lib/server/ai/tools/read.js`
  holds each tool's input schema and an optional `run(input, send, request)`
  that shapes the response. `send` takes any request, so a tool may send more
  than the one the catalog builds.
- Paging is generic. A tool listed in `PAGED_TOOLS` takes a `page`, its first
  page runs without asking, later pages go through the approval card, and
  `describeToolCall` already words that card for any paged tool. `pageRows`
  cuts a full list into pages of `LIST_PAGE_SIZE` (50).
- Every result passes `capSize`, which replaces anything over 20 000 characters
  of JSON with a marked preview.
- The security listings fetch the whole set and return `capRows`, the first 50.
- The Roles screen already searches roles with `buildRoleQuery` and
  `roleMatchesSearch` in `src/lib/security/roleSearch.js`: name substrings
  case-insensitively, or every word of the description. The same module works
  on the server.
- `isSecurityWriteRequest` treats `POST /_security/_query/{user,role,api_key}`
  as reads, so the query endpoints are already allowed for the assistant.

What the cluster offers, recorded in the archived `add-security-management`
design: `_query/role` exists from mid-8.x and answers `no handler found` on
8.0.0; `_query/api_key` exists on 8.0.0; `_query/user` omits reserved users;
`_query/role` can search name, description, metadata, and applications but not
index patterns or privileges; `from` plus `size` is capped at 10 000.

### What the clusters answered

Checked on 8.0.0, 8.19.9, and 9.3.4 with the same seed; all three agreed
except where noted.

| Sent | Answer |
| --- | --- |
| `GET /_security/user/alice,nobody` | 200, only `alice` |
| `GET /_security/user/nobody,noone` | 404, empty body |
| `GET /_security/role/ops,nope` / `…/nope` | 200 with `ops` / 404, empty body |
| `GET /_security/api_key?name=ci-*` | Matches `ci-build`, `ci-deploy`, not `CI-Admin`: case-sensitive |
| `GET /_security/api_key?name=…&username=…` | 400, `username or realm name must not be specified when the api key id or api key name is specified` |
| `GET /_security/api_key?id=bogus` | 404 |
| `GET /_security/api_key?active_only=true` | 8.0.0: 400, unrecognised parameter; later: accepted |
| `_query/api_key`, `wildcard` on `name` with `case_insensitive` | Matches `CI-Admin` too |
| `_query/api_key`, `term` on `username` | Exact and case-sensitive |
| `_query/api_key`, `term` on `invalidated: false` | Leaves invalidated keys out |
| `_query/api_key`, sort `creation` desc then `name` | Accepted |
| `_query/api_key`, `term` on `id` | 400, field `id` not allowed |
| `_query/api_key`, `ids` query | Exact match |
| `role_descriptors` on a key | 8.0.0: never returned; 9.3.4: returned by both GET and query |

## Goals / Non-Goals

**Goals:**

- The assistant can reach any single security record it can name, in one call
  for several names.
- Every listing answers from page 1 when the question can be narrowed, and can
  be walked page by page with approval when it cannot.
- Role search matches the Roles screen, so the assistant and the user see the
  same roles for the same words.

**Non-Goals:**

- Evaluating what a user may actually do. Elasticsearch reports effective
  privileges only for the requesting account, and reproducing its privilege
  model in the app is out of reach.
- Privilege implication. See the privilege filter decision.
- Role mappings, service accounts, and user profiles.

## Decisions

### Three lookup tools, one request each

| Tool | Input | Request |
| --- | --- | --- |
| `get-security-user` | `usernames`: 1 to 20 | `GET /_security/user/<a,b>` |
| `get-security-role` | `names`: 1 to 20 | `GET /_security/role/<a,b>` |
| `get-security-api-key` | any of `id`, `name`, `username`; `include_invalidated` | `POST /_security/_query/api_key` |

Names are encoded segment by segment and joined with commas, the way the
indices tools already encode a model-supplied name, so a name cannot rewrite
the path. The cap of 20 keeps a result of full role definitions under the
character ceiling in the common case; `capSize` still guards the rest.

The user and role endpoints return only the names that exist, and 404 when
none do. The tool compares what came back with what was asked and returns
`{ found: [...], missing: [...] }`, turning the 404 into an empty `found`
rather than an error. The model otherwise reads a 404 as "the cluster is
broken" and says so.

A role is returned as the cluster defines it, including each index entry's
`query` as the stored string and its `field_security`, since that is exactly
what the listing summary leaves out. The credential filter runs on each record,
as in the listings.

The API key lookup goes through the key query rather than
`GET /_security/api_key`, because the GET refuses `name` and `username`
together and 8.0.0 does not accept its `active_only` parameter. The query
exists on every supported version and combines all three identifiers as
filters: an `ids` query for `id` (a `term` on `id` is refused), a
case-insensitive wildcard for `name`, and a `term` for `username`. Invalidated
keys are filtered out in the query unless `include_invalidated` is set. At
least one identifier is required, so the lookup never turns into a listing.

A key's role restrictions (`role_descriptors`) are returned only by clusters
that report them; 8.0.0 omits them from every key API. The result then simply
has none, and the tool description says restrictions appear where the cluster
reports them.

Alternative considered: one `get-security-record` tool with a `type`. Rejected
because each type has different identifiers, and the model picks tools more
reliably from specific names and descriptions.

### Listings gain a search, filters, and a page

Each listing joins `PAGED_TOOLS` and takes `page` plus its own narrowing inputs.
Search and filters apply before paging, so the page count covers only matches.

**Users.** The whole list is fetched, as today, since `_query/user` omits
reserved users. `search` matches username, full name, email, or any role name,
case-insensitively as a substring. The result is paged with `pageRows` in
username order.

**Roles.** Two paths, chosen by the inputs:

```
 search only ------------> POST /_security/_query/role
                           from=(page-1)*50, size=50, sort name asc,
                           query = buildRoleQuery(search)
                                   |
                  no handler found |  (8.0, older 8.x)
                                   v
 index or privilege ----> GET /_security/role (whole list)
 filter given              -> roleMatchesSearch, index and privilege
                              filters, sort by name, pageRows
```

The query endpoint is used only when it can answer the question, since it
cannot see index patterns or privileges. Paging it with `from` rather than a
cursor fits the tool's stateless page numbers. The 10 000 ceiling means page
200, far past anything a conversation walks. The whole-list path sorts names
by code point, as the cluster does, so the two paths order roles the same way.

The catalog builds the query-endpoint request for search-only calls and the
whole-list request otherwise, so the approval card for a later page shows the
request that is expected to run. The one exception is a cluster without the
query endpoint, where the tool sends the whole-list request instead. It reads
the same data, and the card's wording is about the page, not the request line.

**API keys.** `POST /_security/_query/api_key`, which every supported version
has, with `from` and `size`, sorted by `creation` descending then `name`, so the
newest keys lead. `search` matches `name` with a case-insensitive wildcard or
`username` exactly (usernames are case-sensitive), and invalidated keys are
filtered out in the query unless `include_invalidated` is set.

Listing rows stay summaries. Full records come from the lookup tools, and the
listing descriptions say so, so the model reaches for a lookup instead of
paging to find detail.

### The index filter matches role patterns against the name given

`index` is a concrete index name, or a pattern the user typed. An index entry
matches when any of its `names`:

- equals the given string;
- is a wildcard pattern (`*`, `?`) that matches it; or
- is a Lucene regular expression (`/…/`) whose body, read as a JavaScript
  regular expression anchored at both ends, matches it.

Lucene's complement `~(…)` over a whole pattern is read as a negation, since
the builtin roles use it: `viewer` grants `/~(([.]|ilm-history-).*)/`, meaning
every index except hidden ones, and JavaScript would read the `~` as a literal
character. Any other Lucene-only operator (`~` elsewhere, `&`, `<>` intervals,
`@`, `#`), and any regular expression JavaScript cannot parse, is skipped, not
guessed at.
Lucene's syntax is close to JavaScript's for the patterns roles use in practice
(the builtin roles use alternations and character classes), and exact
compatibility would mean shipping a Lucene regexp engine.

### The privilege filter matches names, with `all` as the only implication

`privilege` matches a role holding that exact cluster privilege, or an index
entry holding that exact index privilege. When combined with `index`, both must
hold on the same entry, so "write on logs-*" does not match a role that reads
logs-* and writes elsewhere.

`all` is treated as granting every privilege. Other implications, such as
`write` covering `index` and `delete`, are not applied: Elasticsearch publishes
no machine-readable hierarchy, and it differs between versions. The tool
description tells the model to also try the broader privilege, such as `write`
or `all`, when asked about a narrow one.

### Instructions teach the chain

A short addition to the assistant's instructions: listings return summaries,
full records come from the lookup tools, a user's roles can be fetched in one
call, and narrowing with search or filters beats paging. This follows the
existing line about answering from page 1 of the index listing.

## Risks / Trade-offs

- **Index and privilege filters fetch every role.** On a 7 000-role cluster over
  a slow link that is the 26 s download the Roles screen now avoids. →
  Accepted for these questions, which cannot be answered any other way. The
  work happens in the app's server, and the AI provider receives only the
  matching page.
- **Regular-expression role patterns are matched approximately.** → Patterns
  JavaScript cannot parse are skipped rather than matched loosely, so the error
  is a missed role, never a wrong one. The tool description says regex patterns
  are matched on a best-effort basis.
- **Without privilege implication, a narrow question can miss roles.** → The
  description tells the model to try broader privileges, and `all` is always
  counted.
- **Full role definitions carry document queries to the AI provider.** → These
  are role definitions, not credentials, and are already in scope of the privacy
  policy's description of what the assistant reads. The credential filter is
  unchanged.
