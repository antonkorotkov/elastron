## 1. Store: draft state and persistence

- [x] 1.1 Rename `currentRequest` to `draft` in `src/lib/store/playground.js` and reshape it to `{ name, method, path, bodyText, headers, activeTab }`, with `initialRequest` updated so `bodyText` defaults to `'{}'`; verify `yarn lint` passes and no reference to `currentRequest` remains (`grep -rn currentRequest src/`)
- [x] 1.2 Add `selectedIndex`, `responseBody` and `isRequestLoading` to the `@init` state; verify a new `src/lib/store/playground.test.js` asserts the initial shape
- [x] 1.3 Add a `playground/update` reducer that shallow-merges a patch into `draft` (or into the top-level in-memory fields), mirroring `search/update`; verify a unit test that dispatching `{ method: 'POST' }` leaves `path` and `headers` untouched
- [x] 1.4 Add the debounced persistence writer (`lodash/debounce`, ~300ms) that writes the draft to `playground_draft` via `setStorage`, excluding `selectedIndex`, `responseBody` and `isRequestLoading`; export its `flush()`; verify a unit test that a `bodyText`-only patch does not write synchronously but does after `flush()`
- [x] 1.5 Make any patch touching a field other than `bodyText` write through immediately and flush the pending body write first; verify a unit test that a `bodyText` patch followed by a `method` patch persists both, with the body text present in the written payload
- [x] 1.6 Change `playground/hydrate` to accept `{ templates, draft }` and merge a persisted draft over the defaults; verify a unit test that a partial stored draft (e.g. only `method` and `bodyText`) leaves the remaining fields at their defaults

## 2. Store: templates and connection reset

- [x] 2.1 Update `playground/loadTemplate` to stringify the template's `body` into `draft.bodyText` and replace `name`, `method`, `path` and `headers`; verify a unit test that loading a built-in template yields pretty-printed `bodyText`
- [x] 2.2 Update `playground/saveTemplate` so it sets `draft.name` and no longer replaces the whole draft; verify a unit test that saving does not alter the draft's `bodyText`, `method`, `path` or `headers`
- [x] 2.3 Add a `connected` handler that resets `selectedIndex` to `null` and `responseBody` to `{}` while leaving the draft's `method`, `path`, `bodyText` and `headers` intact; verify a unit test covering both the reset and the retention (spec: "Changing the active connection resets index and response")

## 3. Layout: hydration

- [x] 3.1 In `src/routes/+layout.svelte`, read `playground_draft` alongside `playground_templates` and dispatch the new `playground/hydrate` payload; verify the app starts with a previously saved draft restored (`yarn dev`, edit a request, restart)
- [x] 3.2 Move the `playground/hydrate` dispatch above `dispatch('connection/save')` so the draft exists before `connected` can fire; verify by confirming the draft is not lost on a cold start with a saved connection
- [x] 3.3 Call the store's persistence `flush()` from the existing `beforeunload` handler; verify that typing in the body and immediately quitting retains the text on next launch

## 4. Component: remove the local mirror

- [x] 4.1 Delete the seeding `$effect` at `PlaygroundLayout.svelte:72-86` and the local `$state` for `method`, `path`, `headerItems`, `selectedIndex`, `activeTab`, `responseBody` and `isRequestLoading`; verify `yarn lint` passes
- [x] 4.2 Rewire the method select, URI input, index selector and pane tabs to read from `$playground` and dispatch `playground/update` on change, following the `Search.svelte` control pattern; verify the existing `PlaygroundLayout.svelte.test.js` suite is updated and passes
- [x] 4.3 Bind the request `JsonEditor` with `bind:editor`, seed it once on mount from `draft.bodyText`, and dispatch `playground/update({ bodyText })` from `onChangeText`; verify typing in the body updates the store without the editor losing cursor position
- [x] 4.4 Push the body into the editor explicitly via `setText()` when `playground/loadTemplate` changes the draft; verify loading a template from the drawer replaces the visible body
- [x] 4.5 Update `sendRequest` and `saveTemplate` to parse `draft.bodyText` via `readRequestBody()` and to write `responseBody` / `isRequestLoading` through `playground/update`; verify sending an invalid body reports a parse error and issues no request

## 5. Verification

- [x] 5.1 Run `yarn test` and `yarn lint`; verify both pass clean
- [x] 5.2 Walk the spec scenarios manually in `yarn dev`: edit a request, navigate to Search and back (retained); load a template, edit, navigate away and back (edit retained, not the template); leave the body as incomplete JSON and navigate away and back (text retained verbatim)
- [x] 5.3 Verify restart behaviour: edit a request, quit and relaunch, and confirm the request returns with an empty response pane
- [x] 5.4 Verify the connection reset: select a target index, load the built-in "Delete Index" template, switch to another connection, and confirm the index selector is cleared, the response pane is empty, the path is still `{{index}}`, and sending resolves to `/` rather than `/_all`
