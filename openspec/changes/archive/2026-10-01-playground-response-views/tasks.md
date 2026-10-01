## 1. Request route

- [x] 1.1 In `src/routes/api/elastic/request/+server.js`, call `transport.request(params, { meta: true })` and return `{ statusCode, statusText, contentType, body }` (`statusText` from `node:http` `STATUS_CODES`); verify with a route test that a 200 JSON response and a 200 `text/plain` response both return that shape
- [x] 1.2 Catch `ResponseError` (by `name`, with `meta.statusCode`) in the route and return the same shape from `err.meta`; rethrow everything else; verify with route tests that a 404 returns `{ statusCode: 404, body: <full ES error body> }` with HTTP 200 from the route, and that a `ConnectionError` still yields `{ error, unreachable: true }` with 500
- [x] 1.3 Verify with a route test that `HEAD` returns `{ statusCode: 404, body: false }` for a missing resource and `{ statusCode: 200, body: true }` for an existing one

## 2. Response helpers

- [x] 2.1 Add `src/lib/workspace/playground/response.js` with `pickResponseView`, `toRawText`, `toJsonValue` and `statusClass` (arrow functions); verify with `response.test.js` covering JSON/`vnd.elasticsearch+json` content types, plain text, YAML, booleans, `""`, text that is valid JSON, and 2xx/4xx/5xx classes

## 3. Store

- [x] 3.1 In `src/lib/store/playground.js`, add `responseMeta` (initial `null`) and `responseView` (initial `'json'`) as in-memory keys, change the initial/cleared `responseBody` to `null`, and reset all three on `connected`; verify with updated `playground.test.js` cases that they are not persisted and are cleared on `connected` while the draft is kept

## 4. Playground layout

- [x] 4.1 Update `sendRequest` in `PlaygroundLayout.svelte` to time the request, dispatch `responseBody`, `responseMeta` and `responseView` together for any resolved response without a toast, and on a thrown error show a toast and dispatch `responseBody: null` with `responseMeta: { unreachable: true, durationMs }`; remove the `JSON.parse(error.message)` fallback; keep the stale-connection guard; verify with component tests for a 404 response (no notification) and an unreachable failure (notification + "No response" badge)
- [x] 4.2 Replace the inert "Response" label with `JSON | Raw` tabs styled like the request pane tabs, keep `JsonEditor` mounted and toggled by `display`, and disable the JSON tab with a "Response is not JSON" title when `toJsonValue` is unavailable; verify with component tests that a `_cat` text response opens in Raw with JSON disabled, and a JSON response opens in JSON and can be switched to Raw showing pretty-printed text
- [x] 4.3 Add the Raw view `<pre>` (monospace, `white-space: pre`, scrollable, selectable) with a muted "Empty response" placeholder for `""`; verify with component tests that `""` and `false` replace a previous response
- [x] 4.4 Add the status badge (`<code> <reason> · <n> ms`, green/orange/red with inverted variants, "No response" when unreachable, hidden while `responseMeta` is `null`); verify with component tests for 200, 404, 500, unreachable and the initial state
- [x] 4.5 Update existing `PlaygroundLayout.svelte.test.js` assertions that expect `responseBody` `{}` and the old error-path behaviour; verify `yarn test` passes

## 5. Verification

- [x] 5.1 Run `yarn test` and `yarn lint` and verify both pass
- [x] 5.2 Manually verify in the app against a throwaway cluster: `GET /_cat/indices?v` (Raw, aligned table), `GET /_cluster/health` (JSON, switch to Raw), `GET /missing/_search` (404 badge, full body, no toast), `HEAD /missing` (`false`, 404), malformed query (400 with root cause), stopped cluster (toast + "No response"), and switching connection (pane and badge cleared), in both light and dark themes
