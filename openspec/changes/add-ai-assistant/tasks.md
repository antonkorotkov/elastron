## 1. Dependencies

- [x] 1.1 Add `ai` (major version 7), `@ai-sdk/openai`, `@ai-sdk/anthropic`, `@ai-sdk/google`, and `@ai-sdk/openai-compatible` to `dependencies`, since the server loads them at runtime from the packaged `node_modules`. Add `@ai-sdk/svelte` (major version 5) to `devDependencies` with the other bundled Svelte libraries. Verify `yarn install` and `yarn build` succeed.

## 2. Remove the internet-connectivity subsystem

- [x] 2.1 Delete `src/lib/store/internet.js`, `src/lib/store/internet.test.js`, `src/lib/utils/onlineCheck.js`, `src/lib/header/OnlineIndicator.svelte`, and `src/lib/header/OnlineIndicator.svelte.test.js`, and verify `yarn lint` reports no unresolved imports.
- [x] 2.2 Remove the `internet` registration from `src/lib/store/index.js`, the `InternetConnection` wiring from `src/routes/+layout.svelte`, and the internet references in `Header.svelte.test.js`, and verify `yarn test` passes with no remaining references to the removed module.

## 3. Shared tunnel-aware ES helper

- [x] 3.1 Extract from `handleElasticRequest` in `src/lib/server/elastic.js` a helper that takes a connection and window ID, applies the SSH-tunnel rewrite, creates the client, runs a function, and always closes the client. Make `handleElasticRequest` delegate to it, and verify existing tests still pass and a new unit test covers the tunnel rewrite and client closing on error.
- [x] 3.2 Make the helper mark `ConnectionError`, `TimeoutError`, and `NoLivingConnectionsError` failures as `unreachable: true` in the error response, and leave `ResponseError` unmarked. Add unit tests using the error classes from both the v8 and v9 clients.

## 4. Reachability and the header connection icon

- [x] 4.1 Add `reachable` and `flavor` to `server.js`'s state. Set `reachable` from the `connected` and `disconnected` events and from a new `server/reachability` event, and record `flavor` from the `connected` payload. Extend `server.test.js` to cover each transition.
- [x] 4.2 Make `API._request` report each outcome through a listener the store registers at startup: success reports reachable, and a response marked `unreachable` reports unreachable. Add tests asserting that an unreachable response flips the flag without dispatching `disconnected`, closing the tunnel, or clearing stores, and that an ordinary ES error leaves the flag unchanged.
- [x] 4.3 Replace the header's "Connection" button and `OnlineIndicator` with a plain Semantic UI icon button, not `IconButton`, colored from `$server.reachable` and marked `-webkit-app-region: no-drag`. Extend `Header.svelte.test.js` to cover both colors and to confirm hovering doesn't change the color.
- [x] 4.4 Verify the connection icon opens `ConnectDialog` on click with a `Header.svelte.test.js` case.

## 5. Generic Settings modal shell

- [x] 5.1 Create `src/lib/components/modal/SettingsDialog/SettingsDialog.svelte` with a vertical-tab shell reusing the sidebar layout from `src/routes/index/+layout.svelte`, driven by a list of `{ id, title, component }` sections and opened through `getContext('modal-window').open()`. Add a component test that renders two stub sections and confirms switching leaves the other section's content unchanged.
- [x] 5.2 Add a settings gear button to `Header.svelte`, marked `no-drag`, that opens `SettingsDialog`, and extend `Header.svelte.test.js` to confirm it opens.
- [x] 5.3 Register "AI Integration" as the first section, and verify with a component test that it renders and is selectable.

## 6. AI settings

- [x] 6.1 Add a Storeon module `src/lib/store/aiSettings.js` with the settings shape from design.md decision 6 and `hydrate`, `setActiveProvider`, and `updateProvider` actions persisted with `setStorage('aiSettings', ...)`, and register it in `store/index.js`. Add a store test covering hydration, updates, and that switching the active provider keeps other providers' values.
- [x] 6.2 Hydrate `aiSettings` in `+layout.svelte`'s `onMount` alongside the other stores, and verify a stored value is present in the store after startup.
- [x] 6.3 Build the AI Integration form: an active-provider select, and for each provider a masked API key input and a free-text model input, plus a base URL input for the custom provider. Add a component test covering editing each field, masking, and switching providers without losing values.

## 7. Chat route

- [x] 7.1 Implement the system-prompt builder in `src/lib/server/ai/` from the cluster version and flavor, with tool guidance to validate queries before proposing them and to use `propose-query` for handoff. Add a unit test asserting the version and flavor are present and no credentials or hostnames are.
- [x] 7.2 Implement the model-context builder from design.md decision 12: convert messages, keep the most recent M messages starting at a user message, run `pruneMessages` on older tool traffic and reasoning, and set prompt-caching provider options for Anthropic. Add unit tests asserting old tool results are dropped while assistant replies stay, the window never opens on an orphaned tool result, a pending approval survives pruning, and the input messages are not mutated.
- [x] 7.3 Implement `src/routes/api/ai/chat/+server.js`: read the messages, connection, window ID, active provider settings, and cluster info from the body, build the provider model for OpenAI, Anthropic, Google, or the custom endpoint, and call `streamText` with the context from 7.2, the tool set and its `toolApproval` map, approval signing with a per-process secret, the system prompt as `instructions`, and an explicit `stopWhen` step limit. Add tests asserting a missing provider configuration returns a clear error and that a provider error returned to the renderer never contains the API key.

## 8. Tool layer

- [x] 8.1 Implement the 15 `auto` read tools from design.md's catalog under `src/lib/server/ai/tools/`, each using the shared helper from section 3. Add a unit test per tool asserting the ES request it makes against a mocked client.
- [x] 8.2 Implement the 13 `confirm` named tools with a server-side `execute`, and export a `toolApproval` map giving each the `'user-approval'` policy. Add a unit test per tool asserting it requires approval and makes the expected ES request once approved.
- [x] 8.3 Implement `run-es-request` over the shared helper with the `'user-approval'` policy for every method. Add tests covering a GET and a DELETE request both requiring approval.
- [x] 8.4 Implement `propose-query`, which validates its structured input and makes no ES call. Add a unit test covering the search and request kinds and rejection of malformed input.
- [x] 8.5 Apply the result ceiling to search hits, documents, and every list result (`list-indices`, `list-aliases`, `get-shards`, `get-allocation`), and a size cap to large object results (`get-index`, `get-mapping`, `cluster-stats`, `get-nodes-stats`), marking truncated results. Add unit tests asserting oversized mocked results are cut to the ceiling and marked, and that a request for more than the ceiling is reduced.

## 9. Confirmation flow

- [x] 9.1 Implement the approval card showing the tool, method, full path, and pretty-printed body, styled as destructive for `delete-index`, `wipe-index`, and `delete-document`, and answering through the `Chat` class's `addToolApprovalResponse`. Add a component test covering approval and denial, and asserting a denied action makes no ES request.

## 10. Assistant store and history

- [x] 10.1 Create a Storeon module for assistant state, including the drawer's open state and the current messages, and register it in `store/index.js`. Add a store test covering open, close, and appending messages.
- [x] 10.2 Persist each conversation under a key derived from the connection's host, port, and user, and load the new endpoint's conversation on each `connected` event. Add a test covering switching between endpoints and two saved profiles for one endpoint sharing history.
- [x] 10.3 Enforce the rolling message cap on every write by trimming from the oldest end, persisting tool results in truncated form, and document the chosen constant. Add a unit test asserting the stored conversation never exceeds the cap.
- [x] 10.4 Implement "Clear history" for the active endpoint, and add a test asserting both the stored and in-memory conversation are emptied.

## 11. Assistant drawer UI

- [x] 11.1 Create the assistant drawer, reusing the `TemplateDrawer` pattern, mounted in the root layout and toggled from a new header button marked `no-drag`. Add a component test confirming it opens and closes on every workspace route.
- [x] 11.2 Wire the drawer to the `Chat` class from `@ai-sdk/svelte` against `/api/ai/chat`, sending the connection, window ID, active provider settings, and cluster info with each request. Add a test with a mocked stream that renders a streamed reply.
- [x] 11.3 Show the "configure a provider" state with a link to the Settings modal's AI Integration section when no usable provider is active. Add a component test for it.
- [x] 11.4 Show provider and network errors as a distinct message in the conversation while keeping the user's unsent text. Add a component test for it.

## 12. Query handoff

- [x] 12.1 Render `propose-query` results as a query card with Load into Playground and Copy actions, plus Open in Search for search queries only. Add a component test covering which actions appear for each kind.
- [x] 12.2 Implement Open in Search: dispatch `search/tabs/add` with `{ type: 'body', index, requestBody }` and switch to the Search view without running the query. Add a test covering the new tab's contents and the existing refusal when 20 tabs are open.
- [x] 12.3 Implement Load into Playground: dispatch `playground/loadTemplate` with the method, path, body, and headers and switch to the Playground view. Add a test asserting the draft is replaced.

## 13. Final verification

- [x] 13.1 Add a test asserting a full assistant flow of configuring, chatting, approving, and handing off sends no analytics calls.
- [x] 13.2 Run `yarn lint`, `yarn test`, and `yarn build` across the change and fix any failures.
- [x] 13.3 Manually verify against a throwaway local cluster: a read question, an approved and a denied write, handoff to Search and to Playground, and the connection icon turning red when the cluster stops and green after it restarts.
- [x] 13.4 Run `openspec validate add-ai-assistant --strict` and confirm the change is still valid.

## 14. Follow-up: query parameters and sorted index listing

- [x] 14.1 Give `propose-query` a `querystring` field for request proposals, reject it on search proposals, move any query string written into the path into it, and carry it to the card, Copy, and the Playground URL. Verified by tool tests and a drawer test reproducing the "append ?v&s=store.size:desc&bytes=mb" conversation.
- [x] 14.2 Let `list-indices` take an optional index pattern, a validated sort such as `store.size:desc`, and a byte unit, and tell the model to answer from read tools before handing off a request. Verified by catalog, tool, and instructions tests.
- [x] 14.3 Make `run-es-request` move a query string in its path into `querystring`, so the URL never has two `?`. Verified by catalog and tool tests.

## 15. Follow-up: paged index listing

- [x] 15.1 Page `list-indices` 50 at a time with a `page` argument, returning the total and page count, with a stable order across pages. Verified by tool tests covering first, middle, last, and out-of-range pages.
- [x] 15.2 Require approval for any page after the first through a per-input `toolApproval` rule shared with the catalog, and show which entries the page sends on the approval card. Verified by catalog and tool tests, a streamText test that pauses page 2 and runs it once approved, and a drawer test of the card.
- [x] 15.3 Update the ai-assistant spec's read-only requirement and add a Paged listings requirement. Verified by `openspec validate add-ai-assistant --strict`.

## 16. Follow-up: URI search handoff and quieter retries

- [x] 16.1 Let search proposals carry `q`, `size`, `from`, and `sort` as a URI search that opens in the Search view's URI mode, refusing other parameters or a body alongside `q` with corrective messages. Verified by tool tests, including the previously rejected September-entries proposal, and a drawer test of the URI-mode tab.
- [x] 16.2 Show a tool input the schema refused as a muted, collapsed note instead of a red failure or failed approval card, keeping Elasticsearch errors red. Verified by drawer tests for a refused proposal, a refused write, and a cluster error.
- [x] 16.3 Update the ai-assistant spec's query handoff and add a requirement for rejected tool input. Verified by `openspec validate add-ai-assistant --strict`.

## 17. Follow-up: act with tools instead of giving instructions

- [x] 17.1 Rewrite the system instructions around "act, don't instruct": make requested changes with the matching tool or `run-es-request`, treat the approval card as the confirmation, carry out multi-step changes as tool calls, delete once per index, fix and retry rejected input, and use `propose-query` only for queries the user wants to run themselves. Verified by instructions tests.
- [x] 17.2 Append an approval note to every write tool's description and steer `propose-query` away from changes the user asked for. Verified by tool tests that every write tool, and no read tool, carries the note.
- [x] 17.3 When the user asks to see search results, run the search, sum up what came back, and hand the same query over with `propose-query` rather than pasting hits; answer short questions directly. Verified by instructions and tool tests.

## 18. Follow-up: explicit save in Settings

- [x] 18.1 Give the Settings dialog Cancel and Save actions styled like the other dialogs; each section edits a draft and exposes `save()`, which Save calls for every section. Verified by dialog tests for Save, Cancel, and button styles, and in the running app in both themes.
- [x] 18.2 Replace per-keystroke AI settings writes with a single `aiSettings/save` action that persists the whole draft at once. Verified by store, form, and section tests, and by the analytics test driving the dialog's Save.
- [x] 18.3 Add an Explicit save requirement to the app-settings spec. Verified by `openspec validate add-ai-assistant --strict`.

## 19. Follow-up: chat interaction analytics

- [x] 19.1 Report `assistant_message_sent` when the user sends a message and `assistant_response_received` when the reply to it finishes, once per message and with no parameters, through the analytics store module. Verified by store tests and end-to-end drawer tests covering an approval continuation and a failed reply that is retried.
- [x] 19.2 Add the events to the usage-analytics capability as a spec delta and update the ai-assistant analytics requirement and the proposal. Verified by `openspec validate add-ai-assistant --strict`.
