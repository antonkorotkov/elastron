## Why

Elastron users have to know Elasticsearch's query DSL and API surface themselves to get anything done. An in-app AI assistant that can converse about the connected cluster, build queries, and — with explicit confirmation — perform index and document operations, lets users get unstuck without leaving the app or hand-writing raw requests.

## What Changes

- Add a persistent chat drawer, toggled from the header, scoped to the window's active connection.
- Add a shared server-side tool layer: named tools for the common read and write operations, a query-proposal tool that hands structured queries to the UI, and one generic `run-es-request` fallback. The full catalog is in design.md.
- Read-only tools run automatically. Mutating tools, and every generic request, surface as a confirmation card and run only on explicit approval.
- Tool results sent to the AI provider are capped at a hard ceiling and marked when truncated, so a broad ask doesn't stream a whole dataset to a third party.
- Queries the assistant builds can be opened in a new Search tab or loaded into the Playground draft.
- The assistant is told the connected cluster's version and build flavor, so the requests it proposes are valid for that cluster.
- Add global AI settings: an API key and free-text model id for each provider (OpenAI, Anthropic, Google Gemini, and a custom OpenAI-compatible endpoint with a base URL), plus which provider is active.
- Chat history is one rolling conversation per cluster endpoint, persisted in the existing encrypted local store, automatically trimmed to a bounded number of recent messages, and clearable on demand.
- What each request sends to the AI provider is bounded separately from what is stored: old tool results are pruned and only recent messages are sent, so a long-running conversation doesn't grow slower and more expensive with every turn.
- The assistant reports only two parameter-free usage events to analytics, one when a message is sent and one when its reply arrives. No content, tool, cluster, provider, or model details are sent.
- Add a generic, extensible Settings modal with vertical tabs, opened from a new header gear button. Its first section is "AI Integration."
- Replace the header's "Connection" text button and separate green/red online dot with a single connection icon whose color reflects cluster reachability: red after a connection attempt or any Elasticsearch request fails at the network level, green again after the next success. Ordinary Elasticsearch error responses don't change it.
- Remove the internet online/offline tracking subsystem entirely (`src/lib/store/internet.js`, `src/lib/utils/onlineCheck.js`, `OnlineIndicator.svelte`, their tests, and their wiring in `+layout.svelte`), since nothing uses it once the icon tracks the cluster.
- Out of scope for this change: a spec-compliant external MCP server; per-connection overrides of the AI settings; migrating the Footer theme toggle into the new Settings modal. The first two are deferred to separate, later changes.

## Capabilities

### New Capabilities

- `ai-assistant`: The chat drawer, the tool layer and its read-auto/write-confirm policy, provider settings and credential handling, the cluster context given to the model, tool-result capping, query handoff to Search and Playground, the limits on what reaches analytics, and chat history persistence and retention per cluster endpoint.
- `app-settings`: The generic, extensible Settings modal with vertical tabs, reachable from the header, and how it hosts sections such as AI Integration.
- `connection-status-indicator`: The header's connection icon button, its reachability coloring and what does and doesn't change it, its click behavior, and the removal of the internet-connectivity indicator it replaces.

### Modified Capabilities

- `usage-analytics`: Adds the `assistant_message_sent` and `assistant_response_received` events, which carry no parameters.

Connection objects and the saved-connections list are unchanged, and the query handoff opens search tabs and loads the Playground draft through the existing `search-tabs` and `playground` behaviors without changing their requirements.

## Impact

- New dependencies: the Vercel AI SDK core (`ai`, major version 7), `@ai-sdk/svelte` (major version 5) for the chat UI, and the provider packages `@ai-sdk/openai`, `@ai-sdk/anthropic`, `@ai-sdk/google`, and `@ai-sdk/openai-compatible` for custom endpoints.
- Server: a new streaming route under `src/routes/api/ai/**` and a new `src/lib/server/ai/**` for the tool layer and the model's system context. `src/lib/server/elastic.js` is refactored to expose a shared, SSH-tunnel-aware client helper that both the existing routes and the tools use, and its error responses gain a flag marking network-level failures.
- Renderer: `src/lib/api/elasticsearch.js` reports each request's reachability outcome to the store. `src/lib/store/server.js` gains a reachability flag and records the cluster's build flavor. New Storeon modules hold AI settings and assistant state, registered in `src/lib/store/index.js` and hydrated in `src/routes/+layout.svelte`.
- UI: the assistant drawer, confirmation cards, query cards with Search and Playground actions, the generic `SettingsDialog`, and the reworked header in `src/lib/header/Header.svelte`.
- Persistence: new `electron-store` keys for AI settings and for per-endpoint chat history, through the existing `setStorage`/`getStorage` bridge.
- Removed: `src/lib/store/internet.js` (+test), `src/lib/utils/onlineCheck.js`, `src/lib/header/OnlineIndicator.svelte` (+test), and their registration and wiring in `src/lib/store/index.js` and `src/routes/+layout.svelte`.
