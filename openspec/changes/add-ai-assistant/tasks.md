## 1. Dependencies

- [ ] 1.1 Add `ai` (major version 7), `@ai-sdk/openai`, `@ai-sdk/anthropic`, `@ai-sdk/google`, and `@ai-sdk/openai-compatible` to `dependencies`, since the server loads them at runtime from the packaged `node_modules`. Add `@ai-sdk/svelte` (major version 5) to `devDependencies` with the other bundled Svelte libraries. Verify `yarn install` and `yarn build` succeed.

## 2. Remove the internet-connectivity subsystem

- [ ] 2.1 Delete `src/lib/store/internet.js`, `src/lib/store/internet.test.js`, `src/lib/utils/onlineCheck.js`, `src/lib/header/OnlineIndicator.svelte`, and `src/lib/header/OnlineIndicator.svelte.test.js`, and verify `yarn lint` reports no unresolved imports.
- [ ] 2.2 Remove the `internet` registration from `src/lib/store/index.js`, the `InternetConnection` wiring from `src/routes/+layout.svelte`, and the internet references in `Header.svelte.test.js`, and verify `yarn test` passes with no remaining references to the removed module.

## 3. Shared tunnel-aware ES helper

- [ ] 3.1 Extract from `handleElasticRequest` in `src/lib/server/elastic.js` a helper that takes a connection and window ID, applies the SSH-tunnel rewrite, creates the client, runs a function, and always closes the client. Make `handleElasticRequest` delegate to it, and verify existing tests still pass and a new unit test covers the tunnel rewrite and client closing on error.
- [ ] 3.2 Make the helper mark `ConnectionError`, `TimeoutError`, and `NoLivingConnectionsError` failures as `unreachable: true` in the error response, and leave `ResponseError` unmarked. Add unit tests using the error classes from both the v8 and v9 clients.

## 4. Reachability and the header connection icon

- [ ] 4.1 Add `reachable` and `flavor` to `server.js`'s state. Set `reachable` from the `connected` and `disconnected` events and from a new `server/reachability` event, and record `flavor` from the `connected` payload. Extend `server.test.js` to cover each transition.
- [ ] 4.2 Make `API._request` report each outcome through a listener the store registers at startup: success reports reachable, and a response marked `unreachable` reports unreachable. Add tests asserting that an unreachable response flips the flag without dispatching `disconnected`, closing the tunnel, or clearing stores, and that an ordinary ES error leaves the flag unchanged.
- [ ] 4.3 Replace the header's "Connection" button and `OnlineIndicator` with a plain Semantic UI icon button, not `IconButton`, colored from `$server.reachable` and marked `-webkit-app-region: no-drag`. Extend `Header.svelte.test.js` to cover both colors and to confirm hovering doesn't change the color.
- [ ] 4.4 Verify the connection icon opens `ConnectDialog` on click with a `Header.svelte.test.js` case.

## 5. Generic Settings modal shell

- [ ] 5.1 Create `src/lib/components/modal/SettingsDialog/SettingsDialog.svelte` with a vertical-tab shell reusing the sidebar layout from `src/routes/index/+layout.svelte`, driven by a list of `{ id, title, component }` sections and opened through `getContext('modal-window').open()`. Add a component test that renders two stub sections and confirms switching leaves the other section's content unchanged.
- [ ] 5.2 Add a settings gear button to `Header.svelte`, marked `no-drag`, that opens `SettingsDialog`, and extend `Header.svelte.test.js` to confirm it opens.
- [ ] 5.3 Register "AI Integration" as the first section, and verify with a component test that it renders and is selectable.

## 6. AI settings

- [ ] 6.1 Add a Storeon module `src/lib/store/aiSettings.js` with the settings shape from design.md decision 6 and `hydrate`, `setActiveProvider`, and `updateProvider` actions persisted with `setStorage('aiSettings', ...)`, and register it in `store/index.js`. Add a store test covering hydration, updates, and that switching the active provider keeps other providers' values.
- [ ] 6.2 Hydrate `aiSettings` in `+layout.svelte`'s `onMount` alongside the other stores, and verify a stored value is present in the store after startup.
- [ ] 6.3 Build the AI Integration form: an active-provider select, and for each provider a masked API key input and a free-text model input, plus a base URL input for the custom provider. Add a component test covering editing each field, masking, and switching providers without losing values.

## 7. Chat route

- [ ] 7.1 Implement the system-prompt builder in `src/lib/server/ai/` from the cluster version and flavor, with tool guidance to validate queries before proposing them and to use `propose-query` for handoff. Add a unit test asserting the version and flavor are present and no credentials or hostnames are.
- [ ] 7.2 Implement `src/routes/api/ai/chat/+server.js`: read the messages, connection, window ID, active provider settings, and cluster info from the body, build the provider model for OpenAI, Anthropic, Google, or the custom endpoint, and call `streamText` with the tool set, the system prompt, and an explicit `stopWhen` step limit. Add tests asserting a missing provider configuration returns a clear error and that a provider error returned to the renderer never contains the API key.

## 8. Tool layer

- [ ] 8.1 Implement the 15 `auto` read tools from design.md's catalog under `src/lib/server/ai/tools/`, each using the shared helper from section 3. Add a unit test per tool asserting the ES request it makes against a mocked client.
- [ ] 8.2 Implement the 13 `confirm` named tools with a server-side `execute` and `needsApproval: true`. Add a unit test per tool asserting it requires approval and makes the expected ES request once approved.
- [ ] 8.3 Implement `run-es-request` over the shared helper with `needsApproval: true` for every method. Add tests covering a GET and a DELETE request both requiring approval.
- [ ] 8.4 Implement `propose-query`, which validates its structured input and makes no ES call. Add a unit test covering the search and request kinds and rejection of malformed input.
- [ ] 8.5 Apply the result ceiling to search hits, documents, and every list result (`list-indices`, `list-aliases`, `get-shards`, `get-allocation`), and a size cap to large object results (`get-index`, `get-mapping`, `cluster-stats`, `get-nodes-stats`), marking truncated results. Add unit tests asserting oversized mocked results are cut to the ceiling and marked, and that a request for more than the ceiling is reduced.

## 9. Confirmation flow

- [ ] 9.1 Implement the approval card showing the tool, method, full path, and pretty-printed body, styled as destructive for `delete-index`, `wipe-index`, and `delete-document`, and answering through the `Chat` class's `addToolApprovalResponse`. Add a component test covering approval and denial, and asserting a denied action makes no ES request.

## 10. Assistant store and history

- [ ] 10.1 Create a Storeon module for assistant state, including the drawer's open state and the current messages, and register it in `store/index.js`. Add a store test covering open, close, and appending messages.
- [ ] 10.2 Persist each conversation under a key derived from the connection's host, port, and user, and load the new endpoint's conversation on each `connected` event. Add a test covering switching between endpoints and two saved profiles for one endpoint sharing history.
- [ ] 10.3 Enforce the rolling message cap on every write by trimming from the oldest end, persisting tool results in truncated form, and document the chosen constant. Add a unit test asserting the stored conversation never exceeds the cap.
- [ ] 10.4 Implement "Clear history" for the active endpoint, and add a test asserting both the stored and in-memory conversation are emptied.

## 11. Assistant drawer UI

- [ ] 11.1 Create the assistant drawer, reusing the `TemplateDrawer` pattern, mounted in the root layout and toggled from a new header button marked `no-drag`. Add a component test confirming it opens and closes on every workspace route.
- [ ] 11.2 Wire the drawer to the `Chat` class from `@ai-sdk/svelte` against `/api/ai/chat`, sending the connection, window ID, active provider settings, and cluster info with each request. Add a test with a mocked stream that renders a streamed reply.
- [ ] 11.3 Show the "configure a provider" state with a link to the Settings modal's AI Integration section when no usable provider is active. Add a component test for it.
- [ ] 11.4 Show provider and network errors as a distinct message in the conversation while keeping the user's unsent text. Add a component test for it.

## 12. Query handoff

- [ ] 12.1 Render `propose-query` results as a query card with Load into Playground and Copy actions, plus Open in Search for search queries only. Add a component test covering which actions appear for each kind.
- [ ] 12.2 Implement Open in Search: dispatch `search/tabs/add` with `{ type: 'body', index, requestBody }` and switch to the Search view without running the query. Add a test covering the new tab's contents and the existing refusal when 20 tabs are open.
- [ ] 12.3 Implement Load into Playground: dispatch `playground/loadTemplate` with the method, path, body, and headers and switch to the Playground view. Add a test asserting the draft is replaced.

## 13. Final verification

- [ ] 13.1 Add a test asserting a full assistant flow of configuring, chatting, approving, and handing off sends no analytics calls.
- [ ] 13.2 Run `yarn lint`, `yarn test`, and `yarn build` across the change and fix any failures.
- [ ] 13.3 Manually verify against a throwaway local cluster: a read question, an approved and a denied write, handoff to Search and to Playground, and the connection icon turning red when the cluster stops and green after it restarts.
- [ ] 13.4 Run `openspec validate add-ai-assistant --strict` and confirm the change is still valid.
