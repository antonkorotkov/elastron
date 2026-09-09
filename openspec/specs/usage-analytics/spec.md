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

Analytics payloads SHALL contain only the fields named in this capability plus what the analytics provider collects automatically for page views. Error messages, query text, index names, document contents, hostnames, ports, and connection names SHALL never be sent.

#### Scenario: Error during a request

- **WHEN** any Elasticsearch request or connection attempt fails and an error is shown to the user
- **THEN** no analytics event describing the error is sent
