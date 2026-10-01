## Why

The Playground renders every response in the JSON editor, but many Elasticsearch APIs do not return JSON: `_cat/*` returns a plain-text table, `?format=yaml` returns YAML, and `HEAD` requests return no body at all. These show up as a single escaped string (or not at all) and are unreadable. Separately, the Playground never shows the HTTP status of a response, and it treats every non-2xx answer from the cluster as an application error: the real status is replaced with 500, the cluster's error body is reduced to one reason string, and an error toast is raised. For a request console, a 404 or 400 is an expected answer that the user needs to see in full, not an app failure.

## What Changes

- The response pane gains a **JSON | Raw** view toggle in its tab bar, replacing the inert "Response" label.
- Each new response auto-selects the fitting view: JSON for JSON responses, Raw for text (e.g. `_cat`), and Raw for `HEAD` results (shown as `true` / `false`). The user can switch views for the current response.
- The Raw view shows the response text verbatim (monospace, unwrapped, selectable); a JSON response shown in Raw is pretty-printed. An empty text response shows an explicit empty-state instead of leaving the previous response on screen.
- A **status badge** in the response tab bar shows the HTTP status code, its reason phrase, and the measured round-trip time (e.g. `200 OK · 34 ms`), coloured by status class.
- Any response the cluster returns, including 4xx and 5xx, is displayed as a normal response with its full body and real status. Error toasts are raised only for application failures: cluster unreachable, invalid request-body JSON, or an unexpected server failure.
- The generic request route returns the status code and content type alongside the body. The Playground is its only caller.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `playground`: adds requirements for the response views, the status badge, and treating cluster error responses as responses rather than app errors; extends the connection-change reset to cover the response view and status.

## Impact

- `src/routes/api/elastic/request/+server.js`: request with response metadata; return `{ statusCode, contentType, body }`; handle cluster error responses locally. The shared `handleElasticRequest` helper and all other routes are unchanged.
- `src/lib/api/elasticsearch.js`: `genericRequest` returns the new shape.
- `src/lib/store/playground.js`: new in-memory (non-persisted) response state for the view and status; cleared on connection change.
- `src/lib/workspace/playground/PlaygroundLayout.svelte`: response tab bar, raw view, status badge, simplified error handling.
- Tests: `src/lib/store/playground.test.js`, `src/lib/workspace/playground/PlaygroundLayout.svelte.test.js`, plus a route test.
- No new dependencies. No change to persisted data.
