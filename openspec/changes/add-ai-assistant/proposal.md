## Why

Elastron users have to know Elasticsearch's query DSL and API surface themselves to get anything done. An in-app AI assistant that can converse about the connected cluster, propose queries/mappings/index operations, and — with explicit confirmation — execute them, lets users get unstuck without leaving the app or hand-writing raw requests.

## What Changes

- Add a persistent chat drawer, toggled from the header, scoped to the window's active connection.
- Add a shared server-side tool layer (Vercel AI SDK `tool()` functions) wrapping existing `/api/elastic/**` operations: named tools for the common operations (list indices, run search, get mapping, create/delete index, index a document, cluster health, etc.) plus one generic `run-es-request` fallback wrapping the existing passthrough route.
- Read-only tools execute automatically; any tool that mutates cluster state (create/delete index, index/update/delete document, wipe, mapping/settings changes) surfaces as a confirmation card in the chat and only executes on explicit user approval.
- Tool results returned to the model (search hits, documents, mappings) are truncated/capped by default, so a broad ask doesn't stream a whole dataset to a third-party AI provider.
- Add global AI provider settings (provider, API key, model id as free text) covering OpenAI, Anthropic, Google Gemini, and a custom OpenAI-compatible endpoint (for local/self-hosted models), plus a per-connection override.
- Chat history is a single rolling conversation per connection, persisted via the existing encrypted local store, automatically trimmed to a bounded number of most-recent messages so storage stays bounded without a background cleanup job.
- Add a new generic, extensible Settings modal (vertical tabs) reachable from a new header gear button; its first section is "AI Integration," holding the provider/key/model settings above. Built to hold unrelated settings sections later.
- Replace the header's "Connection" text button + separate green/red online/offline dot with a single connection icon button whose color reflects actual Elasticsearch cluster connection status, not general internet connectivity. **BREAKING (internal only, no external API/data format affected)**.
- Remove the internet online/offline tracking subsystem entirely (`src/lib/store/internet.js`, `src/lib/utils/onlineCheck.js`, `OnlineIndicator.svelte`, their tests, and their wiring in `+layout.svelte`), since it becomes unused once the connection icon switches to ES-connection-status.
- Out of scope for this change: a spec-compliant external MCP server (deferred to a future, separate effort); migrating the existing Footer theme toggle into the new Settings modal.

## Capabilities

### New Capabilities

- `ai-assistant`: The chat drawer, the shared tool layer and its read-auto/write-confirm execution policy, AI provider/model settings (global and per-connection override) and their precedence, tool-result size capping, and chat history persistence/retention per connection.
- `app-settings`: The generic, extensible Settings modal (vertical-tab shell) reachable from the header, and how it hosts settings sections such as AI Integration.
- `connection-status-indicator`: The header's connection icon button — its ES-connection-status coloring, click behavior, and the removal of the general internet-connectivity indicator it replaces.

### Modified Capabilities

(none — the per-connection AI override adds new data associated with a connection, but does not change any existing `connection-management` requirement about how the saved-connections list is added to, deduplicated, replaced, deleted, or restored)

## Impact

- New dependencies: Vercel AI SDK (`ai`) core, `@ai-sdk/svelte` (chat UI bindings), and provider packages (`@ai-sdk/openai`, `@ai-sdk/anthropic`, `@ai-sdk/google`) — the same OpenAI-compatible provider mechanism covers custom/local endpoints.
- New SvelteKit route(s) under `src/routes/api/ai/**` (e.g. `chat/+server.js`) for streaming chat completions with tool calling; new `src/lib/server/ai/tools/**` for the shared tool layer, reusing `src/lib/server/elastic.js`'s `createClient`/`handleElasticRequest`.
- New Storeon store module(s) for assistant/chat state and settings-modal state, registered in `src/lib/store/index.js`.
- New UI: assistant drawer + confirmation-card components, generic Settings modal with vertical tabs, connection icon button — under `src/lib/workspace/assistant/`, `src/lib/components/modal/SettingsDialog/`, and edits to `src/lib/header/Header.svelte`.
- Persistence: extends the existing `electron-store`-backed `setStorage`/`getStorage` bridge with new keys for AI settings, per-connection AI overrides, and per-connection chat history.
- Removed: `src/lib/store/internet.js` (+test), `src/lib/utils/onlineCheck.js`, `src/lib/header/OnlineIndicator.svelte` (+test), and their registration/wiring in `src/lib/store/index.js` and `src/routes/+layout.svelte`.
- Edited: `src/lib/store/server.js` (new `connected` boolean, set from the existing `connected`/`disconnected` events already dispatched by `connection.js`), `src/lib/components/modal/ConnectionDialog/*` (new AI override section).
