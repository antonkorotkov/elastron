## Context

See proposal.md for motivation. Relevant existing architecture (see `CLAUDE.md`):

- The renderer never talks to Elasticsearch directly; every operation goes through a SvelteKit `+server.js` route under `src/routes/api/elastic/**`, which uses `src/lib/server/elastic.js`'s `createClient`/`handleElasticRequest`. A generic passthrough already exists at `/api/elastic/request`.
- Electron `main.js` forks the adapter-node server and IPC is deliberately minimal (window management, persisted store, updates) — ES/business logic does not belong in `main.js`.
- App state is Storeon modules under `src/lib/store/`, composed in `store/index.js`; persistence goes through `setStorage`/`getStorage` (`src/lib/utils/storage.js`) to an encrypted `electron-store` via IPC.
- There is exactly one active connection per window (`connection` store), and existing per-window "draft" state (Playground's draft, Search tabs) is persisted under flat, non-window-scoped keys — the app already accepts "last write wins" for that kind of state rather than reconciling multiple windows.
- Two UI precedents already exist that this change reuses rather than inventing new primitives: a slide-out drawer (Playground's `TemplateDrawer`, driven by `isDrawerOpen` in `playground.js`), and a vertical tab sidebar (`ui vertical fluid pointing menu` + `ui grid`, used for per-index tabs in `src/routes/index/+layout.svelte`). Styling is Semantic UI (`static/semantic.min.css`), including its icon font classes.

## Goals / Non-Goals

**Goals:**
- Land a working assistant (chat + shared tool layer + confirmation flow + provider settings + generic Settings shell + header rework) using the existing architectural conventions above, not new ones.
- Shape the tool layer (typed functions with schemas, one module per operation plus one generic fallback) so a future real-MCP wrapper could reuse the same modules without rewriting them.

**Non-Goals:**
- A spec-compliant MCP server or any endpoint reachable by external processes (explicitly deferred, per proposal.md).
- Reconciling assistant state across multiple windows open on the same connection simultaneously — this follows the same last-write-wins behavior the app already has for Playground drafts and Search tabs.
- Any input modality beyond text (voice, file upload, etc.).
- Migrating the Footer's theme toggle into the new Settings modal.

## Decisions

**1. Tool layer is plain AI SDK `tool()` functions, not a protocol server.**
Each tool is a module under `src/lib/server/ai/tools/` exporting a schema and an `execute` that calls the existing `createClient`/`handleElasticRequest` helpers — the same helpers every `+server.js` route already uses. This matches the project rule that ES logic lives in SvelteKit server code, and avoids standing up a second process/transport inside Electron for a v1 with exactly one consumer. Alternative considered: build the real MCP server now. Rejected — it adds an authn/authz surface (token issuance, network exposure, resolving which connection an external, window-less caller targets) with no user yet; that's explicitly a later, separate effort.

Tools call the shared ES-client helpers in-process — the same `createClient`/`handleElasticRequest` pattern (or `client.transport.request` directly) every `+server.js` route body already uses — rather than issuing an HTTP request to the existing `/api/elastic/**` routes over the network. That means a tool is not limited to operations that already have a dedicated route: `get-mapping` and `get-index-settings` below are reads the ES client already supports (mirroring the *write* side of `index/mapping` and `index/settings`, which are PUT-only today) that get added directly against the client, not by adding new public HTTP endpoints for them.

**Tool catalog.** Confirmed against the actual route handlers in `src/routes/api/elastic/**` during exploration. "Policy" is `auto` (the ai-assistant spec's "read-only actions run automatically") or `confirm` (its "mutating actions require explicit confirmation").

| Tool | Underlying ES operation | Policy |
| --- | --- | --- |
| `list-indices` | `GET /_cat/indices` (same op as `/api/elastic/indices`) | auto |
| `get-index` | `GET /{index}` — full definition: settings, mappings, aliases (same op as `/api/elastic/index/get`) | auto |
| `get-mapping` | `GET /{index}/_mapping` (new — no dedicated existing route; mirrors the write side already in `/api/elastic/index/mapping`) | auto |
| `get-index-settings` | `GET /{index}/_settings` (new — no dedicated existing route; mirrors the write side already in `/api/elastic/index/settings`) | auto |
| `run-search-body` | `POST /{index}/_search` with a JSON query body (same op as `/api/elastic/search/body`) | auto |
| `run-search-uri` | `GET /{index}/_search` with query-string params (same op as `/api/elastic/search/uri`) | auto |
| `cluster-health` | `GET /_cluster/health` (same op as `/api/elastic/cluster/health`) | auto |
| `cluster-stats` | `GET /_cluster/stats` (same op as `/api/elastic/cluster/stats`) | auto |
| `get-allocation` | `GET /_cat/allocation` (same op as `/api/elastic/allocation`) | auto |
| `get-shards` | `GET /_cat/shards` (same op as `/api/elastic/shards`) | auto |
| `get-nodes-stats` | `GET /_nodes/stats/os,jvm,fs` (same op as `/api/elastic/nodes/stats`) | auto |
| `create-index` | `PUT /{index}` (same op as `/api/elastic/index/create`) | confirm |
| `delete-index` | `DELETE /{index}` (same op as `/api/elastic/index/delete`) | confirm — destructive |
| `clone-index` | `POST /{existingIndex}/_clone/{newIndex}` (same op as `/api/elastic/index/clone`) | confirm |
| `close-index` | `POST /{index}/_close` (same op as `/api/elastic/index/close`) | confirm |
| `open-index` | `POST /{index}/_open` (same op as `/api/elastic/index/open`) | confirm |
| `wipe-index` | `POST /{index}/_delete_by_query` matching all documents — the index itself is not removed (same op as `/api/elastic/index/wipe`) | confirm — destructive |
| `update-mapping` | `PUT`/per-type `POST` on `/{index}/_mapping...` (same op as `/api/elastic/index/mapping`) | confirm |
| `update-index-settings` | `PUT /{index}/_settings` (same op as `/api/elastic/index/settings`) | confirm |
| `create-alias` | `POST /{index}/_alias/{alias}` (same op as `/api/elastic/alias/create`) | confirm |
| `delete-alias` | `DELETE /{index}/_alias/{alias}` (same op as `/api/elastic/alias/delete`) | confirm |
| `index-document` | `PUT /{index}/{type}/{id}` (same op as `/api/elastic/document/index`) | confirm |
| `update-document` | `POST /{index}/_update/{id}` (same op as `/api/elastic/document/update`) | confirm |
| `delete-document` | `DELETE /{index}/{type}/{id}` (same op as `/api/elastic/document/delete`) | confirm — destructive |
| `run-es-request` | Arbitrary `{method, path, querystring, body, headers}` (same op as the `/api/elastic/request` passthrough) | confirm, always — regardless of the underlying method |

Excluded from the tool catalog: connection testing (`/api/elastic/test`) and SSH tunnel open/close (`/api/elastic/tunnel/**`). Both are connection-lifecycle plumbing tied to a specific window, not actions a conversation should trigger directly.

**2. Chat endpoint and streaming.**
One route, `src/routes/api/ai/chat/+server.js`, built on the `ai` package's `streamText`, given the resolved provider/model/key and the full tool set, returning a stream the renderer consumes via `@ai-sdk/svelte`. Provider selection (OpenAI/Anthropic/Google/custom OpenAI-compatible) happens server-side by constructing the matching provider client from the resolved settings before calling `streamText` — the API key is never sent to or read back from the renderer beyond populating the settings form.

**3. Settings precedence resolution.**
A small server-side resolver picks the active connection's AI override when present, else the global settings, immediately before each chat request — kept server-side since the API key must not round-trip through the renderer more than necessary.

**4. Confirmation flow for mutating tools.**
Mutating tools omit a direct `execute` (or return a pending marker) so the SDK's tool loop stops before running them; the client renders a confirmation card from the proposed call's arguments, and approval re-invokes the tool with its execute step. Read-only tools define `execute` directly and run inline. This reuses the AI SDK's own tool-approval mechanism rather than inventing a bespoke pause/resume protocol.

**5. Connected-state tracking for the header icon.**
`src/lib/store/server.js` gains a `connected` boolean, set `true`/`false` by the existing `connected`/`disconnected` events that `connection.js` already dispatches on save success/failure. No new event wiring — just a new field reacting to events that already fire.

**6. Chat history storage shape and retention enforcement.**
Stored under a per-connection key (same pattern as `lastConnection`/`playground_draft`) as a message list, capped to the most recent N messages, trimmed from the front on every write so the persisted payload can never exceed the cap regardless of conversation length. N is a fixed constant chosen during implementation (task-level detail, not a spec-level one).

**7. Settings modal reuses the existing modal-window context and tab layout.**
`SettingsDialog` opens via the same `getContext('modal-window').open()` mechanism `ConnectionDialog` already uses from `Header.svelte`; its section list reuses the `ui vertical fluid pointing menu` + `ui grid` layout already present in `src/routes/index/+layout.svelte` — no new tab-switching primitive.

## Risks / Trade-offs

- [Risk] A provider outage or bad API key breaks the assistant mid-conversation. → Mitigation: surface provider errors as a distinct inline chat message, and never discard the user's in-progress draft message on failure.
- [Risk] An API key leaks via logs or a support bundle. → Mitigation: same treatment already given to connection passwords — masked in the settings form, only ever persisted through the encrypted `electron-store` bridge, never written to client-side console logging.
- [Risk] The rolling message cap silently drops old context. → Mitigation: the manual "Clear history" action gives an explicit way to manage history, and trimming only removes from the oldest end, preserving the most relevant recent context.
- [Risk] A confirmation card under-describes a mutating action, leading to an unintended approval. → Mitigation: the ai-assistant spec requires at minimum the operation and its target; tasks should render the full request path/body for every mutating tool, not just its name.
- [Trade-off] Bounding tool-result size by default means a request like "summarize all 50,000 documents" won't literally see all 50,000. Accepted, given the explicit priority on not leaking large amounts of cluster data to a third party by default.

## Migration Plan

- Additive only: existing connection objects gain an optional `ai` override field; its absence means "use global settings," so existing saved connections remain valid unchanged.
- Removing the internet-online-tracking subsystem is a clean deletion — confirmed during exploration that nothing outside its own files (`internet.js`, `internet.test.js`, `onlineCheck.js`, `OnlineIndicator.svelte`, its test, and their registration in `store/index.js`/`+layout.svelte`) reads `$internet.online`.
- No migration of existing `electron-store` data; new keys (global AI settings, per-connection AI override, per-connection chat history) are additive.
- Rollback removes the new routes/store modules/UI; no persisted data format is left in a shape older code can't read, since nothing existing is restructured.

## Open Questions

- Exact numeric values for the message-cap retention limit and the per-tool-result truncation size are implementation constants — both are just "a bounded number" at the spec level, so they can be picked during task execution rather than resolved here.
