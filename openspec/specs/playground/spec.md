# Playground Specification

## Purpose

Defines the request Playground's working draft: what a user's in-progress request retains as they move between views and restart the app, how saved templates interact with that draft, and what is discarded when the active connection changes.

## Requirements

### Requirement: The working draft survives view navigation

The Playground SHALL retain the user's in-progress request when the user navigates to another view and back. The retained draft comprises the HTTP method, the URI path, the request body text, and the target index.

Navigating away and back SHALL NOT replace the draft with a previously loaded or saved template.

#### Scenario: Edited request is retained across navigation

- **WHEN** the user edits the method, path or body in the Playground, navigates to the Search view, and navigates back to the Playground
- **THEN** the Playground shows the edited request exactly as the user left it

#### Scenario: Draft survives after a template was loaded

- **WHEN** the user loads a saved template, edits the request away from that template, navigates to another view, and navigates back
- **THEN** the Playground shows the edited request, not the template that was loaded

#### Scenario: Selected index is retained

- **WHEN** the user selects a target index, navigates away, and navigates back
- **THEN** the same target index is still selected

### Requirement: The working draft survives an application restart

The Playground SHALL persist the draft and restore it when the application starts. The response body and any in-flight request state SHALL NOT be persisted.

#### Scenario: Draft restored after restart

- **WHEN** the user edits a request in the Playground and restarts the application
- **THEN** the Playground shows the request as it was left

#### Scenario: Response is not restored

- **WHEN** the user sends a request, receives a response, and restarts the application
- **THEN** the Playground shows the restored request with an empty response pane

#### Scenario: First run with no persisted draft

- **WHEN** the application starts and no draft has ever been persisted
- **THEN** the Playground shows its default request (`GET {{index}}/_search` with an empty body)

### Requirement: The request body is retained exactly as typed

The Playground SHALL retain the request body as the literal text the user typed, including text that is not valid JSON at the moment the user navigates away or the application exits. Body text SHALL be parsed only when a request is sent or a template is saved.

#### Scenario: Incomplete JSON is retained

- **WHEN** the user types a partial body such as `{ "query": { "bool":` and navigates away and back
- **THEN** the body pane shows that partial text unchanged

#### Scenario: Invalid body is reported on send

- **WHEN** the user sends a request while the body text is not valid JSON
- **THEN** the Playground reports the parse failure and does not issue the request

### Requirement: Loading a template replaces the draft

Loading a saved or built-in template SHALL replace the current draft's method, path and body text with the template's, and the body pane SHALL display the template's body.

Saving a template SHALL NOT alter the draft the user is editing beyond associating it with the saved name.

#### Scenario: Template replaces the working request

- **WHEN** the user has an edited request and loads a template from the drawer
- **THEN** the method, path and body shown are the template's

#### Scenario: Loaded template becomes the new draft

- **WHEN** the user loads a template, navigates away, and navigates back
- **THEN** the Playground shows the loaded template's request

### Requirement: Changing the active connection resets index and response

When the application connects to a cluster, the Playground SHALL clear the selected target index and the response pane, including the response view selection and the status badge. The method, path and body text of the draft SHALL be retained.

The cleared index SHALL be the Playground's unset state, in which a `{{index}}` placeholder is stripped from the path rather than substituted. The Playground SHALL NOT substitute `_all` for an unset index, because the path is interpolated into arbitrary requests where `_all` is destructive — notably the built-in "Delete Index" template, whose path is `{{index}}` alone.

#### Scenario: Index is cleared on connection change

- **WHEN** the user has selected a target index and then connects to a different cluster
- **THEN** no target index is selected

#### Scenario: Request is retained on connection change

- **WHEN** the user has an edited method, path and body and then connects to a different cluster
- **THEN** those values are unchanged

#### Scenario: Stale response is discarded on connection change

- **WHEN** the user has a response displayed and then connects to a different cluster
- **THEN** the response pane is empty and no status badge is shown

#### Scenario: Unset index does not target every index

- **WHEN** the target index is unset and the user sends the built-in "Delete Index" template, whose path is `{{index}}`
- **THEN** the resolved path is `/` and no index is deleted

### Requirement: The response pane offers JSON and raw text views

The Playground response pane SHALL offer two views of the current response: a JSON view and a Raw view. The user SHALL be able to switch between them for the current response.

The Raw view SHALL show the response text verbatim in a monospace font, without wrapping lines, with the text selectable. A JSON response shown in the Raw view SHALL be pretty-printed. A text response that is empty SHALL show an explicit empty-response state in the Raw view.

The JSON view SHALL be unavailable for a text response that cannot be parsed as JSON, and SHALL indicate that the response is not JSON.

#### Scenario: Text response is readable in the Raw view

- **WHEN** the user sends `GET /_cat/indices?v`
- **THEN** the Raw view shows the column-aligned text table exactly as the cluster returned it, one row per line

#### Scenario: JSON response can be viewed as raw text

- **WHEN** the user sends `GET /_cluster/health` and switches to the Raw view
- **THEN** the Raw view shows the response as pretty-printed JSON text

#### Scenario: JSON view is unavailable for non-JSON text

- **WHEN** the current response is the text output of a `_cat` request
- **THEN** the JSON view cannot be selected and indicates that the response is not JSON

#### Scenario: Text that is valid JSON can be viewed as JSON

- **WHEN** the current response is text whose content is valid JSON
- **THEN** the user can switch to the JSON view and see it rendered as JSON

#### Scenario: Empty text response replaces the previous response

- **WHEN** a response is displayed and the user sends a request whose response is empty text
- **THEN** the Raw view shows the empty-response state and the previous response is no longer shown

### Requirement: Each new response selects the fitting view

When a response arrives, the Playground SHALL select the view that fits it: the JSON view for a JSON response, and the Raw view for a text response. A `HEAD` request's result SHALL be shown in the Raw view as the text `true` when the resource exists and `false` when it does not. The view the user switched to for an earlier response SHALL NOT carry over to a new response.

#### Scenario: JSON response opens in the JSON view

- **WHEN** the user sends `GET {{index}}/_search`
- **THEN** the response is shown in the JSON view

#### Scenario: Text response opens in the Raw view

- **WHEN** the user sends `GET /_cat/indices`
- **THEN** the response is shown in the Raw view without the user switching views

#### Scenario: HEAD result is shown as text

- **WHEN** the user sends `HEAD` to an index that does not exist
- **THEN** the Raw view shows `false` and the previous response is no longer shown

#### Scenario: Manual view choice does not carry over

- **WHEN** the user switches a JSON response to the Raw view and then sends another request that returns JSON
- **THEN** the new response is shown in the JSON view

#### Scenario: View choice survives navigation

- **WHEN** the user switches the current response to the Raw view, navigates to another view, and navigates back
- **THEN** the same response is shown in the Raw view

### Requirement: The response pane shows the status and round-trip time

After a request completes, the response pane SHALL show a status badge containing the HTTP status code, its reason phrase, and the round-trip time of the request in milliseconds (for example `200 OK · 34 ms`). The badge SHALL be visually distinguished by status class: success (2xx), client error (4xx), and server error (5xx). When the cluster could not be reached, the badge SHALL indicate that no response was received. When a request fails for any other reason that is not a cluster response, no badge SHALL be shown. No badge SHALL be shown before the first request completes after start-up or a connection change.

#### Scenario: Successful response shows its status and time

- **WHEN** the user sends `GET /_cluster/health` and the cluster answers with 200
- **THEN** the badge shows `200 OK` with the round-trip time, styled as a success

#### Scenario: Client error shows its status

- **WHEN** the user sends `GET /missing-index/_doc/1` and the cluster answers with 404
- **THEN** the badge shows `404 Not Found` with the round-trip time, styled as a client error

#### Scenario: HEAD result shows its status

- **WHEN** the user sends `HEAD` to an index that does not exist
- **THEN** the badge shows `404 Not Found`

#### Scenario: Unreachable cluster shows no response

- **WHEN** the user sends a request and the cluster cannot be reached
- **THEN** the badge indicates that no response was received

#### Scenario: Other failures show no badge

- **WHEN** the user sends a request that fails for a reason other than reaching the cluster, such as a failure in the application's own request handling
- **THEN** an error notification names the failure, the response pane is empty, and no status badge is shown

#### Scenario: No badge before the first request

- **WHEN** the application starts and the user has not sent a request
- **THEN** no status badge is shown

### Requirement: Cluster error responses are responses, not application errors

Any response the cluster returns, whatever its status, SHALL be displayed in the response pane with the full body the cluster sent and its real status code. The Playground SHALL NOT raise an error notification for a response the cluster returned. Error notifications SHALL be raised only for application failures: the cluster could not be reached, the request body is not valid JSON, or the request could not be performed for another reason that is not a cluster response.

#### Scenario: Error response body is shown in full

- **WHEN** the user sends a search with a malformed query and the cluster answers with 400
- **THEN** the response pane shows the cluster's complete error body, including its root cause, and the badge shows `400 Bad Request`

#### Scenario: Not-found response raises no notification

- **WHEN** the user sends `GET /missing-index/_search` and the cluster answers with 404
- **THEN** no error notification is shown

#### Scenario: Unreachable cluster raises a notification

- **WHEN** the user sends a request and the cluster cannot be reached
- **THEN** an error notification names the failure

### Requirement: Requests carry only connection-level headers

The Playground SHALL NOT offer a way to set HTTP headers on an individual request. A Playground request SHALL carry the headers configured on the active connection, and no others. Headers stored in a draft or template saved before this requirement SHALL be ignored.

#### Scenario: No per-request headers can be set

- **WHEN** the user opens the Playground
- **THEN** there is no control for adding request headers

#### Scenario: Connection headers apply

- **WHEN** the active connection has custom headers configured and the user sends a request
- **THEN** the request carries those headers

#### Scenario: Previously saved headers are ignored

- **WHEN** the user loads a template saved with request headers and sends it
- **THEN** the request carries only the connection's headers

### Requirement: Each request is sent once and only the latest fills the response pane

A Playground request SHALL be sent to the cluster exactly once, without automatic retries, so that the status and round-trip time shown describe a single attempt and a write is not repeated. When the user sends a new request before an earlier one completes, only the latest request's outcome SHALL be shown, and the request SHALL be shown as in progress until the latest one completes.

#### Scenario: A failed write is not retried

- **WHEN** the user sends `POST /logs/_doc` and the cluster answers with 503
- **THEN** the request was sent once and the badge shows `503 Service Unavailable`

#### Scenario: An earlier response does not replace a later one

- **WHEN** the user sends request A, then request B before A completes, and B completes before A
- **THEN** the response pane shows B's response and status after A completes

#### Scenario: Loading lasts until the latest request completes

- **WHEN** the user sends request A, then request B, and A completes first
- **THEN** the request is still shown as in progress and A's response is not shown
