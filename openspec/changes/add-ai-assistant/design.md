## Context

See proposal.md for motivation. Relevant existing architecture (see `CLAUDE.md`):

- The renderer never talks to Elasticsearch directly. Every operation goes through a SvelteKit `+server.js` route under `src/routes/api/elastic/**`, which calls `handleElasticRequest` in `src/lib/server/elastic.js`. That helper parses the HTTP request, rewrites the connection to `127.0.0.1:<tunnelPort>` when the window has an active SSH tunnel, creates a v8 or v9 client, runs the action, closes the client, and returns an HTTP response. Every error becomes a 500 with a reason string; nothing distinguishes an unreachable cluster from an Elasticsearch error response.
- On the renderer side, every call goes through `API._request` in `src/lib/api/elasticsearch.js`, which sends the full connection object, credentials included, in each request body.
- In production the SvelteKit server is a process forked by Electron `main.js`; in development it is the Vite dev server. Either way it has no access to `electron-store`, which lives in Electron main and is reached only by the renderer through the `store:get`/`store:set` IPC bridge. IPC is deliberately minimal.
- App state is Storeon modules under `src/lib/store/`, composed in `store/index.js` and hydrated in `src/routes/+layout.svelte`'s `onMount`.
- The `connected` and `disconnected` store events fire only on the outcome of a connection attempt. `disconnected` also closes the SSH tunnel, resets the indices, shards, allocation, mappings, and monitoring stores, and posts a "Disconnected from the server" notice. Nothing detects a cluster going away after a successful connect.
- Connections have no stable ID; the saved list deduplicates by deep equality.
- UI precedents reused here: Playground's slide-out `TemplateDrawer`, the `ui vertical fluid pointing menu` + `ui grid` tab sidebar in `src/routes/index/+layout.svelte`, the `modal-window` context used by `ConnectionDialog`, and Semantic UI's icon classes. `IconButton.svelte` toggles the `green` class on hover, so it can't carry a status color.
- The search store's `search/tabs/add` accepts config overrides and refuses at `MAX_TABS` (20) with a notification. The Playground's `playground/loadTemplate` replaces the draft's method, path, body, and headers.
- The `usage-analytics` spec allows only the fields it names.

## Goals / Non-Goals

**Goals:**
- Land the assistant (chat, tool layer, confirmation flow, provider settings, query handoff, generic Settings shell, and header rework) using the existing conventions above.
- Keep tool modules self-contained (schema plus execute) so a future MCP wrapper could reuse them unchanged.

**Non-Goals:**
- A spec-compliant MCP server or any endpoint reachable by external processes.
- Per-connection overrides of the AI settings. Deferred to a later change, which will first need a stable connection identity.
- Reconciling assistant state across multiple windows on the same endpoint. It follows the last-write-wins behavior the app already has for Playground drafts and Search tabs.
- Input beyond text, and migrating the Footer theme toggle into Settings.
- Summarizing or compacting old conversation, and a user-facing "New conversation" divider. Automatic pruning (decision 12) covers the cost problem for v1; either can be added later if long conversations still drift.

## Decisions

**1. The tool layer is AI SDK `tool()` modules running in the SvelteKit server, sharing a tunnel-aware client helper with the routes.**
Each tool lives in `src/lib/server/ai/tools/` and exports an input schema and an `execute`. Tools run in-process with the chat route and must not call the app's own `/api/elastic/**` routes over HTTP. They can't reuse `handleElasticRequest` as-is either, because it speaks HTTP and holds the SSH-tunnel rewrite. So `elastic.js` gets a lower-level helper that takes a connection and window ID, applies the tunnel rewrite, creates the client, runs a function, and always closes the client. `handleElasticRequest` becomes a thin HTTP wrapper around it, and tools call it directly. Without this, tools on tunneled connections would bypass the tunnel and hit the wrong host.
Alternative considered: a real MCP server now. Rejected for v1. It needs an authentication and connection-targeting model for external callers that has no user yet.

**Tool catalog.** Checked against the route handlers in `src/routes/api/elastic/**`. `auto` runs without confirmation; `confirm` sets `needsApproval` (decision 4).

| Tool | Underlying ES operation | Policy |
| --- | --- | --- |
| `list-indices` | `GET /_cat/indices?format=json` (same op as `/api/elastic/indices`) | auto |
| `list-aliases` | `GET /_cat/aliases?format=json` (new, no existing route) | auto |
| `get-index` | `GET /{index}`: settings, mappings, aliases (same op as `/api/elastic/index/get`) | auto |
| `get-mapping` | `GET /{index}/_mapping` (new; the existing `index/mapping` route only writes) | auto |
| `get-index-settings` | `GET /{index}/_settings` (new; the existing `index/settings` route only writes) | auto |
| `get-document` | `GET /{index}/_doc/{id}` (new, no existing route) | auto |
| `run-search-body` | `POST /{index}/_search` with a JSON query body (same op as `/api/elastic/search/body`) | auto |
| `run-search-uri` | `GET /{index}/_search` with query-string params (same op as `/api/elastic/search/uri`) | auto |
| `count` | `POST /{index}/_count` with an optional query (new, no existing route) | auto |
| `validate-query` | `POST /{index}/_validate/query?explain=true` with a query body (new, no existing route) | auto |
| `cluster-health` | `GET /_cluster/health` (same op as `/api/elastic/cluster/health`) | auto |
| `cluster-stats` | `GET /_cluster/stats` (same op as `/api/elastic/cluster/stats`) | auto |
| `get-allocation` | `GET /_cat/allocation?format=json` (same op as `/api/elastic/allocation`) | auto |
| `get-shards` | `GET /_cat/shards?format=json` (same op as `/api/elastic/shards`) | auto |
| `get-nodes-stats` | `GET /_nodes/stats/os,jvm,fs` (same op as `/api/elastic/nodes/stats`) | auto |
| `create-index` | `PUT /{index}` (same op as `/api/elastic/index/create`) | confirm |
| `delete-index` | `DELETE /{index}` (same op as `/api/elastic/index/delete`) | confirm, destructive |
| `clone-index` | `POST /{existingIndex}/_clone/{newIndex}` (same op as `/api/elastic/index/clone`) | confirm |
| `close-index` | `POST /{index}/_close` (same op as `/api/elastic/index/close`) | confirm |
| `open-index` | `POST /{index}/_open` (same op as `/api/elastic/index/open`) | confirm |
| `wipe-index` | `POST /{index}/_delete_by_query` over all documents; the index stays (same op as `/api/elastic/index/wipe`) | confirm, destructive |
| `update-mapping` | `PUT /{index}/_mapping` (same op as `/api/elastic/index/mapping`) | confirm |
| `update-index-settings` | `PUT /{index}/_settings` (same op as `/api/elastic/index/settings`) | confirm |
| `create-alias` | `POST /{index}/_alias/{alias}` (same op as `/api/elastic/alias/create`) | confirm |
| `delete-alias` | `DELETE /{index}/_alias/{alias}` (same op as `/api/elastic/alias/delete`) | confirm |
| `index-document` | `PUT /{index}/_doc/{id}` (same op as `/api/elastic/document/index`) | confirm |
| `update-document` | `POST /{index}/_update/{id}` (same op as `/api/elastic/document/update`) | confirm |
| `delete-document` | `DELETE /{index}/_doc/{id}` (same op as `/api/elastic/document/delete`) | confirm, destructive |
| `run-es-request` | Arbitrary `{method, path, querystring, body, headers}` (same op as `/api/elastic/request`) | confirm, always, regardless of method |
| `propose-query` | No ES call. Takes a structured `{kind: 'search' \| 'request', index, method, path, body}` and returns it for the UI to render as a query card (decision 9) | auto |

Excluded: connection testing (`/api/elastic/test`) and SSH tunnel open/close (`/api/elastic/tunnel/**`). They are per-window connection plumbing, not conversational actions.

**2. One streaming chat route with an explicit step limit and cluster context.**
`src/routes/api/ai/chat/+server.js` calls the `ai` package's `streamText` with the resolved provider model, the tool set, a system prompt, and an explicit `stopWhen` step limit lower than the SDK's default of 20. It returns a UI message stream consumed by the `Chat` class from `@ai-sdk/svelte`. The messages it passes to `streamText` go through the context builder in decision 12 first. The request body carries the messages, the connection and window ID for the tools, the active provider's settings (decision 3), and the cluster's version and flavor. The system prompt, built in `src/lib/server/ai/`, states the cluster version and flavor, describes the tools, and tells the model to check a query with `validate-query` before proposing it and to hand queries to the user through `propose-query`. It contains no credentials or hostnames. `src/lib/store/server.js` already holds the version; it also starts recording the flavor from the `connected` event payload.

**3. The API key travels from the renderer with each chat request.**
The server has no access to `electron-store`, so the renderer loads the AI settings through the existing bridge and sends the active provider's key, model, and base URL with each chat request. This is the same loopback path ES credentials already take on every `/api/elastic/**` call. The route builds the provider client per request, never logs or persists the key, and strips it from any error text it returns. With only global settings, choosing the provider is a lookup of `activeProvider`; there is no precedence logic.
Alternative considered: pass the key from Electron main to the forked server. Rejected. It adds an IPC channel against the project's minimal-IPC rule, doesn't exist in development where Vite is the server, and protects nothing, because the renderer already holds ES passwords the same way.

**4. Confirmation uses the SDK's tool approval, with execution staying on the server.**
Mutating tools keep their server-side `execute` and set `needsApproval: true`, as does `run-es-request`. The stream pauses with a tool-approval request, and the drawer renders a confirmation card showing the tool, method, full path, and pretty-printed body, with destructive tools styled in red. The user's choice goes back through the `Chat` class's `addToolApprovalResponse`. On approval the server runs `execute`; on denial the model is told the action was declined.
Alternative rejected: leaving out `execute` would make these client-side tools, so the renderer would have to run the ES write itself, which breaks the rule that ES logic lives in SvelteKit server code.

**5. Reachability is a separate flag, fed from the one request choke point.**
`server.js` gains a `reachable` boolean. It is set `true` by the existing `connected` event, `false` by the existing `disconnected` event, and both ways by a new `server/reachability` event. The shared helper from decision 1 classifies client errors by name: `ConnectionError`, `TimeoutError`, and `NoLivingConnectionsError` mark the error response `unreachable: true`; `ResponseError` does not. `API._request` reports every outcome: success means reachable, and a response carrying `unreachable` means unreachable. The `API` class has no store reference today, so it reports through a listener the store registers at startup. It must never dispatch `disconnected`, because that closes the tunnel, resets five data stores, and posts a disconnection notice. The header icon reads `reachable`.
Tool calls made by the chat route don't feed the flag in v1. Their failures show as tool errors in the conversation instead.

**6. Settings shape.**
Stored under the `aiSettings` key and hydrated in `+layout.svelte` with the other stores:
`{ activeProvider: 'openai' | 'anthropic' | 'google' | 'custom' | null, providers: { openai: { apiKey, model }, anthropic: { apiKey, model }, google: { apiKey, model }, custom: { apiKey, model, baseUrl } } }`.

**7. History is keyed by cluster endpoint and capped at write time.**
Connections have no stable ID, so each conversation is stored under a key derived from the connection's `host`, `port`, and `user`. Profiles pointing at the same cluster share history, and editing a profile's name, color, headers, or password keeps it. The assistant store loads the conversation for the new endpoint on each `connected` event. Every append trims from the oldest end to the most recent N messages before persisting. Tool results are persisted in their truncated form, so a single message can't carry a large payload into storage.

**8. The Settings modal reuses the existing modal context and tab layout.**
`SettingsDialog` opens through `getContext('modal-window').open()`, like `ConnectionDialog`. Its section list reuses the index view's vertical tab sidebar. Sections are a list of `{ id, title, component }`, so adding one doesn't touch the others.

**9. Query handoff goes through a structured tool, not text parsing.**
The model hands queries over by calling `propose-query`, so the UI never has to find JSON inside prose. Its result renders as a query card with three actions:
- Open in Search, only for `kind: 'search'`, dispatches `search/tabs/add` with `{ type: 'body', index, requestBody }` and switches to the Search view without running the query. The existing `MAX_TABS` refusal and its notification apply.
- Load into Playground dispatches `playground/loadTemplate` with the method, path, body, and headers, then switches to the Playground view. Like loading a template, it replaces the current draft.
- Copy puts the request on the clipboard.

**10. Header controls.**
The connection icon is a plain Semantic UI icon button, not `IconButton`, colored from `$server.reachable`. The settings gear and the assistant toggle sit beside it. All three need `-webkit-app-region: no-drag`, because the header bar is a window drag region.

**11. Analytics stays untouched.**
No new analytics events. The drawer is not a route, so it produces no page views, and no chat, tool, provider, or model data reaches `trackPageView` or `gtag`.

**12. Model context is pruned and windowed separately from storage.**
Provider APIs are stateless, so every request carries whatever context the model should see. Without a bound, a rolling conversation resends its whole stored history every turn, getting slower and more expensive and eventually overflowing the model's context window. Tool results are most of that weight here: search hits, mappings, index lists. Before each request, the chat route builds the model context in three steps:
- Convert the UI messages to model messages with `convertToModelMessages`.
- Keep only the most recent M messages, cutting at a user-message boundary so the window never opens on an orphaned tool result.
- Call the SDK's `pruneMessages` to drop tool calls and results before the last few messages, and reasoning before the last message. The assistant's text replies stay, and they already summarize what the tools found.
Tool-approval requests and responses sit in the most recent messages, so pruning never removes an approval in flight. The stored conversation and the drawer's display are untouched. Where the provider supports it, prompt caching is enabled through provider options, marking the system prompt and tool definitions as cacheable for Anthropic; OpenAI and Gemini cache repeated prefixes on their own.
Alternatives considered: OpenAI's server-side conversation state and Anthropic's server-side context management. Rejected as the primary mechanism because each works with only one of the four providers and neither reduces what OpenAI bills per turn. Summarization was also deferred: it adds a model call and real complexity for a gain pruning mostly already delivers.

## Risks / Trade-offs

- [Risk] Pruned tool results mean the model can't quote old data exactly. → It re-runs the read tool, which is automatic and cheap, and its earlier replies still carry what it concluded.
- [Risk] The API key sits in renderer memory and crosses loopback with each chat request. → Same exposure ES passwords already have. Mitigated by masking in the form, never logging, and stripping the key from error text.
- [Risk] Error classification depends on the ES client's error class names, and both client versions are bundled. → Unit tests cover the v8 and v9 error classes.
- [Risk] A dead cluster takes up to the client's timeout times its retries before the icon turns red. → Accepted. The icon reflects the last completed request.
- [Risk] Persisted history inflates the store as endpoints accumulate. → Each endpoint holds at most N messages with truncated tool results, and the user can clear history.
- [Risk] The model proposes a query invalid for the cluster's version. → The version is in the system prompt, and the prompt directs the model to `validate-query` before proposing.
- [Risk] A confirmation card under-describes an action. → The card always shows the method, full path, and body.
- [Risk] A provider outage or bad key breaks the conversation. → Errors appear as a distinct message in the conversation, and the user's unsent draft is kept.
- [Trade-off] Load into Playground overwrites an unsaved draft. Accepted, for consistency with how loading a template already behaves.
- [Trade-off] The result ceiling means "summarize all 50,000 documents" won't see them all. Accepted. The truncation marker lets the model say so.

## Migration Plan

- Connection objects and the saved-connections list don't change.
- New `electron-store` keys are additive: `aiSettings` and one history key per endpoint.
- The `handleElasticRequest` refactor keeps every route's behavior. Error responses gain an optional `unreachable` field, which existing callers ignore.
- Removing the internet-tracking subsystem is a clean deletion. Nothing outside its own files, its registration in `store/index.js`, its wiring in `+layout.svelte`, and `Header.svelte.test.js` references it.
- Rollback removes the new routes, modules, and UI. No persisted data is left in a shape older code can't read.

## Open Questions

- Exact values for the history message cap, the tool-result ceiling, the step limit, the context window M, and how many recent messages keep their tool results. They are implementation constants that don't change the specs or the task breakdown.
