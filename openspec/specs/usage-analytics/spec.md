# Usage Analytics Specification

## Purpose

Defines what Elastron reports to Google Analytics about its own usage: which fields are sent, on which occasions, and under which conditions nothing is sent at all. The capability exists so the maintainer can see which app releases and Elasticsearch versions are in use without ever sending data that could identify a user, a cluster, or its contents.

## Requirements

### Requirement: Analytics is active only with a measurement ID

The app SHALL send analytics only when a Google Analytics measurement ID was provided at build time, and SHALL send it to that measurement ID. When no measurement ID is present, the app SHALL send nothing to Google Analytics and SHALL NOT load the analytics script. The build mode (development server or packaged app) SHALL NOT affect whether or where analytics is sent.

#### Scenario: Build without a measurement ID

- **WHEN** the app was built with no measurement ID configured
- **THEN** no analytics script is loaded and no page view, user property or event is sent

#### Scenario: Running from the development server with a measurement ID

- **WHEN** the app runs from the Vite development server and a measurement ID is configured
- **THEN** page views, the user property and events are sent to that measurement ID exactly as from a packaged build

#### Scenario: Analytics script blocked or not yet loaded

- **WHEN** the analytics script could not load or has not finished loading at the moment an event would be sent
- **THEN** the app continues to operate normally and the failure to report is silent to the user

### Requirement: Every analytics call targets the configured measurement ID

All analytics traffic SHALL be sent to the measurement ID configured at build time. No call SHALL target a placeholder or literal template value.

#### Scenario: Initial page load

- **WHEN** the app window first loads with a measurement ID configured
- **THEN** the page view for the initial route is attributed to the configured measurement ID

### Requirement: The running app version accompanies every event

The app SHALL report its own release version, as declared in its package metadata, as a user-scoped property named `app_version`. The property SHALL be set before the first page view of a window so that every event sent from that window carries it.

#### Scenario: Page view carries the app version

- **WHEN** a window loads and the first page view is sent
- **THEN** that page view, and every subsequent event from the window, carries `app_version` equal to the running release version

#### Scenario: New window after an update

- **WHEN** the app has been updated and restarted and a window loads
- **THEN** events from that window carry the new release version, not the previous one

### Requirement: Establishing a cluster connection is reported with the cluster version

Each time the app successfully establishes a connection to an Elasticsearch cluster, it SHALL send one event named `cluster_connected` carrying the cluster's version number as `es_version` and, when the cluster reports it, its build flavor as `es_flavor`. The event SHALL carry no other cluster-identifying data: no host, port, connection name, credentials, index names or node names.

#### Scenario: Successful connection

- **WHEN** a connection attempt succeeds and the cluster reports version `8.12.0` with build flavor `default`
- **THEN** one `cluster_connected` event is sent with `es_version` = `8.12.0` and `es_flavor` = `default`

#### Scenario: Cluster omits the build flavor

- **WHEN** a connection attempt succeeds and the cluster's version response has no build flavor
- **THEN** one `cluster_connected` event is sent with `es_version` set and `es_flavor` omitted

#### Scenario: Failed connection

- **WHEN** a connection attempt fails for any reason, including SSH tunnel failure
- **THEN** no `cluster_connected` event is sent

#### Scenario: Every window reports its own connection

- **WHEN** the user opens a second window that connects to the same cluster
- **THEN** a separate `cluster_connected` event is sent from that window

#### Scenario: Connection established at launch

- **WHEN** the app launches and reconnects to the last used connection automatically
- **THEN** a `cluster_connected` event is sent exactly as for a connection the user initiated

### Requirement: No sensitive data is reported

Analytics payloads SHALL contain only the fields named in this capability plus what the analytics provider collects automatically for page views. Error messages, query text, index names, document contents, hostnames, ports, and connection names SHALL never be sent. A page view SHALL report the route's pattern rather than the visited URL, so a route carrying a value in its path does not disclose it.

#### Scenario: Viewing one index's page

- **WHEN** the user opens the page of an index named `orders-2026.08`
- **THEN** the page view reports the route pattern `/index/[index]`, and the index name is not sent

#### Scenario: Error during a request

- **WHEN** any Elasticsearch request or connection attempt fails and an error is shown to the user
- **THEN** no analytics event describing the error is sent

### Requirement: Assistant chat interactions are reported without content
Each time the user sends a message to the AI assistant, the app SHALL send one event named `assistant_message_sent`. When the reply to that message finishes, the app SHALL send one event named `assistant_response_received`. A reply that continues after the user approves an action belongs to the same message and SHALL NOT be reported again. A reply that fails, is stopped, or loses its connection SHALL NOT be reported as received; if the user retries and the retry finishes, it SHALL be. Neither event SHALL carry any parameters: no message text, reply text, tool names or results, index or query details, provider, model, or error text.

#### Scenario: Sending a message and receiving the reply
- **WHEN** the user sends a message to the assistant and its reply finishes
- **THEN** one `assistant_message_sent` event and one `assistant_response_received` event are sent, each with no parameters

#### Scenario: A reply that continues after an approval
- **WHEN** the reply to a message asks for approval, the user approves, and the assistant continues
- **THEN** only one `assistant_response_received` event is sent for that message

#### Scenario: A failed reply that is retried
- **WHEN** the reply to a message fails and the user retries it successfully
- **THEN** no `assistant_response_received` event is sent for the failure, and one is sent when the retry finishes

#### Scenario: No content in assistant events
- **WHEN** any assistant event is sent
- **THEN** it carries none of the message, the reply, tool calls, cluster data, the provider, the model, or the API key
