## ADDED Requirements

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

After a request completes, the response pane SHALL show a status badge containing the HTTP status code, its reason phrase, and the round-trip time of the request in milliseconds (for example `200 OK · 34 ms`). The badge SHALL be visually distinguished by status class: success (2xx), client error (4xx), and server error (5xx). When the cluster could not be reached, the badge SHALL indicate that no response was received. No badge SHALL be shown before the first request completes after start-up or a connection change.

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

## MODIFIED Requirements

### Requirement: Changing the active connection resets index and response

When the application connects to a cluster, the Playground SHALL clear the selected target index and the response pane, including the response view selection and the status badge. The method, path, body text and headers of the draft SHALL be retained.

The cleared index SHALL be the Playground's unset state, in which a `{{index}}` placeholder is stripped from the path rather than substituted. The Playground SHALL NOT substitute `_all` for an unset index, because the path is interpolated into arbitrary requests where `_all` is destructive — notably the built-in "Delete Index" template, whose path is `{{index}}` alone.

#### Scenario: Index is cleared on connection change

- **WHEN** the user has selected a target index and then connects to a different cluster
- **THEN** no target index is selected

#### Scenario: Request is retained on connection change

- **WHEN** the user has an edited method, path, body and headers and then connects to a different cluster
- **THEN** those values are unchanged

#### Scenario: Stale response is discarded on connection change

- **WHEN** the user has a response displayed and then connects to a different cluster
- **THEN** the response pane is empty and no status badge is shown

#### Scenario: Unset index does not target every index

- **WHEN** the target index is unset and the user sends the built-in "Delete Index" template, whose path is `{{index}}`
- **THEN** the resolved path is `/` and no index is deleted
