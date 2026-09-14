## 1. Dependencies

- [ ] 1.1 Add `ai`, `@ai-sdk/svelte`, `@ai-sdk/openai`, `@ai-sdk/anthropic`, and `@ai-sdk/google` to `package.json` and verify `yarn install` completes cleanly.

## 2. Remove the internet-connectivity subsystem

- [ ] 2.1 Delete `src/lib/store/internet.js`, `src/lib/store/internet.test.js`, `src/lib/utils/onlineCheck.js`, `src/lib/header/OnlineIndicator.svelte`, and `src/lib/header/OnlineIndicator.svelte.test.js`, and verify `yarn lint` reports no unresolved imports.
- [ ] 2.2 Remove the `internet` module registration from `src/lib/store/index.js` and the `InternetConnection`/`internet/online`/`internet/offline` wiring from `src/routes/+layout.svelte`, and verify `yarn test` passes with `grep -rn "internet" src` returning no remaining references to the removed module.

## 3. Connection status tracking and header connection icon

- [ ] 3.1 Add a `connected` boolean to `server.js`'s initial state, set `true` on the existing `connected` event and `false` on `disconnected`, and extend `server.test.js` to cover both transitions.
- [ ] 3.2 Replace the header's "Connection" text button and `OnlineIndicator` with a single `IconButton`-based connection icon colored from `$server.connected`, and extend `Header.svelte.test.js` to cover both the connected and disconnected render states.
- [ ] 3.3 Verify the new connection icon still opens `ConnectDialog` on click via an updated `Header.svelte.test.js` case, matching the behavior of the button it replaces.

## 4. Generic Settings modal shell

- [ ] 4.1 Create `src/lib/components/modal/SettingsDialog/SettingsDialog.svelte` implementing a vertical-tab shell (reusing the `ui vertical fluid pointing menu` + `ui grid` pattern from `src/routes/index/+layout.svelte`), opened via `getContext('modal-window').open()`, and add a component test that renders the shell with two stub sections and confirms switching sections leaves the other section's content unchanged.
- [ ] 4.2 Add a settings gear `IconButton` to `Header.svelte` that opens `SettingsDialog`, and extend `Header.svelte.test.js` to confirm it opens.
- [ ] 4.3 Add an "AI Integration" section entry to `SettingsDialog`'s section list as the first registered section, and verify a component test confirms it renders and is selectable.

## 5. AI settings data model and persistence

- [ ] 5.1 Define the global AI settings shape (`provider`, `apiKey`, `model`, and `baseUrl` for the custom provider) and add a new Storeon module (`src/lib/store/aiSettings.js`) with `@init`/`hydrate`/`update` actions persisted via `setStorage('aiSettings', ...)`, registered in `store/index.js`, and add a store unit test covering hydrate, update, and persistence.
- [ ] 5.2 Extend `initialConnection` (`connection.js`) and `normalizeConnection` (`connections.js`) with an optional `ai` override field using the same shape as 5.1, defaulting to absent, and verify existing `connection.test.js`/`connections.test.js` suites still pass with the new field defaulted for connections that don't set it.
- [ ] 5.3 Build the AI Integration settings form (provider select, masked API key input matching how connection passwords are masked, free-text model input, conditional base-URL field for the custom provider) inside `SettingsDialog`'s AI Integration section, bound to the `aiSettings` store, and add a component test covering filling in and saving each field.
- [ ] 5.4 Add the same override fields as an optional section inside `ConnectionDialog`, bound to the connection draft's `ai` field, and add a component test covering enabling the override and confirming it is included in the saved connection.

## 6. Server-side settings resolution and chat route

- [ ] 6.1 Implement a server-side resolver (`src/lib/server/ai/resolveSettings.js`) that returns the connection's `ai` override when present, else the global settings, given both objects, and add a unit test covering the override, fallback, and "neither configured" cases.
- [ ] 6.2 Implement `src/routes/api/ai/chat/+server.js`: parse the request (messages, connection, windowId), resolve settings via 6.1, construct the matching AI SDK provider client, call `streamText` with the tool set from section 7, and return the stream response; add an integration test asserting a request with no provider configured returns a clear, distinct error rather than an opaque failure.

## 7. Shared tool layer

- [ ] 7.1 Implement the 11 `auto`-policy read tools from design.md's tool catalog (`list-indices`, `get-index`, `get-mapping`, `get-index-settings`, `run-search-body`, `run-search-uri`, `cluster-health`, `cluster-stats`, `get-allocation`, `get-shards`, `get-nodes-stats`) under `src/lib/server/ai/tools/`, each calling the ES client directly (`createClient`/`handleElasticRequest`-style, per design.md decision 1 — not by fetching the existing HTTP routes), and add a unit test per tool asserting it calls the ES client with the expected arguments against a mocked client.
- [ ] 7.2 Implement the 13 `confirm`-policy named tools from the catalog (`create-index`, `delete-index`, `clone-index`, `close-index`, `open-index`, `wipe-index`, `update-mapping`, `update-index-settings`, `create-alias`, `delete-alias`, `index-document`, `update-document`, `delete-document`) without a direct `execute` step per design.md's confirmation-flow decision, and add a unit test per tool asserting it produces a pending/needs-confirmation call rather than executing immediately.
- [ ] 7.3 Implement the generic `run-es-request` fallback tool wrapping the existing `/api/elastic/request` passthrough, always `confirm`-policy regardless of the underlying method, and add a unit test covering both a read-shaped and a write-shaped raw request.
- [ ] 7.4 Implement default truncation of tool results that return documents or large payloads (search hits from `run-search-body`/`run-search-uri`, document bodies from `get-index`), per the ai-assistant spec's tool-result-size requirement, and add a unit test asserting a large mocked result set is truncated to the bound.

## 8. Confirmation flow

- [ ] 8.1 Implement the confirm/decline UI for a pending mutating tool call — a card showing the operation, its target, and the request path/body — wired to re-invoke the tool's execute step on confirm and to no-op on decline, and add a component test covering both the confirm and decline scenarios from the ai-assistant spec.

## 9. Assistant store module and conversation persistence

- [ ] 9.1 Create a Storeon module for assistant state (drawer open/closed, current messages), registered in `store/index.js`, and add a store unit test covering open/close and message append.
- [ ] 9.2 Implement per-connection persistence: store the conversation under a per-connection key via `setStorage`/`getStorage`, restored when the active connection changes, and add a test covering switching connections and retrieving the correct history for each.
- [ ] 9.3 Implement the rolling message-count cap (choose and document the constant, e.g. 200 messages) enforced on every write by trimming from the oldest end, and add a unit test asserting the stored payload never exceeds the cap after repeated appends.
- [ ] 9.4 Implement a manual "Clear history" action for the active connection's conversation, and add a test asserting both the stored and in-memory conversation are emptied.

## 10. Assistant drawer UI

- [ ] 10.1 Create the assistant drawer component (reusing the drawer pattern from `TemplateDrawer.svelte`/`isDrawerOpen`), toggled from a new header control, mounted at the root layout so it is available from every workspace page, and add a component test confirming it opens/closes and renders regardless of the active route.
- [ ] 10.2 Wire the drawer's message list and input to `@ai-sdk/svelte`'s chat primitive against `/api/ai/chat`, streaming assistant replies into the panel, and add an integration test (mocked fetch/stream) that renders a streamed assistant reply.
- [ ] 10.3 Render the "no provider configured" prompt state, linking directly to the Settings modal's AI Integration section, and add a component test covering this empty-state path per the ai-assistant spec.

## 11. Final verification

- [ ] 11.1 Run `yarn lint` and `yarn test` across the full change and fix any failures.
- [ ] 11.2 Run `openspec validate add-ai-assistant --strict` and confirm the change remains valid after implementation.
