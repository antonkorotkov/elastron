## Purpose

Defines the request Playground's working draft: what a user's in-progress request retains as they move between views and restart the app, how saved templates interact with that draft, and what is discarded when the active connection changes.

## ADDED Requirements

### Requirement: The working draft survives view navigation

The Playground SHALL retain the user's in-progress request when the user navigates to another view and back. The retained draft comprises the HTTP method, the URI path, the request body text, the header list, the target index, and the selected request pane (body or headers).

Navigating away and back SHALL NOT replace the draft with a previously loaded or saved template.

#### Scenario: Edited request is retained across navigation

- **WHEN** the user edits the method, path, body or headers in the Playground, navigates to the Search view, and navigates back to the Playground
- **THEN** the Playground shows the edited request exactly as the user left it

#### Scenario: Draft survives after a template was loaded

- **WHEN** the user loads a saved template, edits the request away from that template, navigates to another view, and navigates back
- **THEN** the Playground shows the edited request, not the template that was loaded

#### Scenario: Selected index and pane are retained

- **WHEN** the user selects a target index, switches to the Headers pane, navigates away, and navigates back
- **THEN** the same target index is still selected and the Headers pane is still active

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
- **THEN** the Playground shows its default request (`GET {{index}}/_search` with an empty body and no headers)

### Requirement: The request body is retained exactly as typed

The Playground SHALL retain the request body as the literal text the user typed, including text that is not valid JSON at the moment the user navigates away or the application exits. Body text SHALL be parsed only when a request is sent or a template is saved.

#### Scenario: Incomplete JSON is retained

- **WHEN** the user types a partial body such as `{ "query": { "bool":` and navigates away and back
- **THEN** the body pane shows that partial text unchanged

#### Scenario: Invalid body is reported on send

- **WHEN** the user sends a request while the body text is not valid JSON
- **THEN** the Playground reports the parse failure and does not issue the request

### Requirement: Loading a template replaces the draft

Loading a saved or built-in template SHALL replace the current draft's method, path, body text and headers with the template's, and the body pane SHALL display the template's body.

Saving a template SHALL NOT alter the draft the user is editing beyond associating it with the saved name.

#### Scenario: Template replaces the working request

- **WHEN** the user has an edited request and loads a template from the drawer
- **THEN** the method, path, body and headers shown are the template's

#### Scenario: Loaded template becomes the new draft

- **WHEN** the user loads a template, navigates away, and navigates back
- **THEN** the Playground shows the loaded template's request

### Requirement: Changing the active connection resets index and response

When the application connects to a cluster, the Playground SHALL clear the selected target index and the response pane. The method, path, body text and headers of the draft SHALL be retained.

The cleared index SHALL be the Playground's unset state, in which a `{{index}}` placeholder is stripped from the path rather than substituted. The Playground SHALL NOT substitute `_all` for an unset index, because the path is interpolated into arbitrary requests where `_all` is destructive — notably the built-in "Delete Index" template, whose path is `{{index}}` alone.

#### Scenario: Index is cleared on connection change

- **WHEN** the user has selected a target index and then connects to a different cluster
- **THEN** no target index is selected

#### Scenario: Request is retained on connection change

- **WHEN** the user has an edited method, path, body and headers and then connects to a different cluster
- **THEN** those values are unchanged

#### Scenario: Stale response is discarded on connection change

- **WHEN** the user has a response displayed and then connects to a different cluster
- **THEN** the response pane is empty

#### Scenario: Unset index does not target every index

- **WHEN** the target index is unset and the user sends the built-in "Delete Index" template, whose path is `{{index}}`
- **THEN** the resolved path is `/` and no index is deleted
