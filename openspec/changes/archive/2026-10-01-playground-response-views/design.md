## Context

See proposal.md for motivation; requirements are in `specs/playground/spec.md`.

Current request path:

```
PlaygroundLayout.sendRequest
  -> API.genericRequest -> POST /api/elastic/request
       -> handleElasticRequest (shared by every route)
            -> client.transport.request(params)        // body only
            <- json({ data: body })
            on throw: json({ error: getErrorReason(err) }, 500)
  <- response.data -> playground/update { responseBody }
  on throw: JSON.parse(error.message) (never succeeds) -> { error } + toast
```

- The ES client leaves non-JSON bodies (`text/plain`, YAML) as strings, casts `HEAD` bodies to booleans, and throws `ResponseError` for any status >= 400 (except `HEAD` 404, which it returns as `false`).
- `handleElasticRequest` is shared by all routes; its error contract (`error`, `unreachable`) is relied on elsewhere and must not change.
- `genericRequest` has exactly one caller: the Playground.
- `JsonEditor` ignores falsy values (`if (value && …)`), so `""` and `false` never replace the previous response.

## Goals / Non-Goals

**Goals:**
- Carry status code, reason phrase and content type from the cluster to the renderer for the Playground only.
- Keep the view/status state in the existing store module, in memory, alongside `responseBody`.

**Non-Goals:**
- Changing `handleElasticRequest` or any other route's contract.
- Showing response headers, or a syntax-highlighted/searchable raw viewer.
- Formatting binary formats (`format=cbor`, `format=smile`); they appear as whatever text the client produces.
- Using the cluster's `took` as the timing; it only exists on some APIs and excludes transport.

## Decisions

### 1. The request route returns metadata and handles cluster error responses itself

```
request/+server.js (inside the handleElasticRequest action)
  try   res = transport.request(params, { meta: true })
        return toResult(res)
  catch err.name === 'ResponseError' && err.meta?.statusCode
        return toResult(err.meta)
  else  rethrow  --> shared path: { error, unreachable? } 500, unchanged

toResult({ statusCode, headers, body }) =
  { statusCode, statusText: STATUS_CODES[statusCode], contentType: headers['content-type'], body }
```

- `statusText` comes from `node:http` `STATUS_CODES` on the server, so the renderer needs no status table.
- Identifying `ResponseError` by `name` follows the existing `UNREACHABLE_ERROR_NAMES` convention and works for both bundled clients (8 and 9).
- Alternative: pass `ignore: [...]` for all status codes. Rejected: the list is open-ended and it would not give `ResponseError`'s parsed body any more reliably.
- Alternative: extend `handleElasticRequest` to forward `err.meta`. Rejected: it would change the error contract for every route and risk leaking request-derived data that `describeErrorForLog` deliberately withholds.

`genericRequest` returns the `{ statusCode, statusText, contentType, body }` object as is.

### 2. Store shape

Add to the in-memory keys of `playground` (not persisted, reset on `connected`):

- `responseMeta`: `null` before any request; otherwise `{ statusCode, statusText, contentType, durationMs }`, or `{ unreachable: true, durationMs }` when the request failed without a cluster response.
- `responseView`: `'json' | 'raw'`.

`responseBody` keeps its meaning (the cluster body) but may now be a string or a boolean. The initial/cleared value becomes `null` rather than `{}`, so "no response" is distinguishable from an empty JSON object.

### 3. View selection and raw text are pure helpers

A small module next to the layout (e.g. `src/lib/workspace/playground/response.js`) with unit tests:

- `pickResponseView({ body, contentType })`: `'json'` when the content type contains `json`, or the body is an object; otherwise `'raw'` (strings, booleans).
- `toRawText(body)`: strings unchanged, booleans as `'true'`/`'false'`, objects via `JSON.stringify(body, null, 2)`.
- `toJsonValue(body)`: objects unchanged, strings via `JSON.parse` (returns an "unavailable" marker on failure), booleans unavailable.
- `statusClass(statusCode)`: `'success' | 'client-error' | 'server-error'`.

`sendRequest` dispatches `responseBody`, `responseMeta` and `responseView: pickResponseView(...)` in a single `playground/update`, which resets any manual choice for the new response. Clicking a tab dispatches only `responseView`.

### 4. Round-trip time is measured in the renderer

`performance.now()` around `api.genericRequest`, rounded to whole ms. This is the latency the user experiences (renderer -> local server -> tunnel -> cluster). The same measurement is recorded for the unreachable case.

### 5. Error handling in `sendRequest`

- A resolved `genericRequest` is always a cluster response, whatever the status: no toast.
- A thrown error is an application failure: toast with the message, `responseBody: null`, `responseMeta: { unreachable: true, durationMs }`. The pane is cleared rather than left showing a previous response under a "No response" badge.
- The `JSON.parse(error.message)` fallback is removed.
- Invalid request-body JSON keeps its current behaviour (toast, no request, response pane untouched).
- The existing stale-connection guard applies to all three dispatched keys.

### 6. Response pane UI

```
+-----------+-----------+------------------------------+
|   JSON    |    Raw    |      [ 404 Not Found · 34 ms ]|
+-----------+-----------+------------------------------+
| JsonEditor (display toggled)  |  <pre> raw text      |
+------------------------------------------------------+
```

- The inert "Response" label is replaced by two tabs styled like the request pane's `Request Body | Headers`, plus the badge right-aligned in the same bar.
- The `JsonEditor` stays mounted and is hidden with `display`, as the request pane already does, so switching views does not recreate the editor.
- The JSON tab is `disabled` with a `title` of "Response is not JSON" when `toJsonValue` is unavailable.
- Raw view: `<pre>` with `white-space: pre`, `overflow: auto`, monospace, selectable; `""` renders a muted "Empty response" placeholder.
- Badge colours use the Semantic UI label colours already in use (green / orange / red), with inverted variants for dark mode, following the project's UI conventions for badges.

## Risks / Trade-offs

- [Very large text responses in a `<pre>` could be slow to render] → Acceptable for `_cat` sizes; the JSON editor has the same exposure today. Revisit only if reported.
- [Content types other than JSON/text, e.g. `format=cbor`] → Shown as raw text from whatever the client decoded; explicitly a non-goal.
- [`responseBody` initial value changes from `{}` to `null`] → Existing tests asserting `{}` are updated; nothing else reads it.
- [A proxy in front of ES returning HTML error pages] → Arrives as a `ResponseError` with a string body; shown in Raw with its status, which is the desired outcome.

## Migration Plan

None. No persisted data changes; `responseBody` and the new keys are in memory only.
