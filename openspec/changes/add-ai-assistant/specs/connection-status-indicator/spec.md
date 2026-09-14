## Purpose

Gives the user a persistent, at-a-glance signal of whether the application can currently reach the configured Elasticsearch cluster, replacing a general internet-connectivity indicator that did not reflect cluster reachability.

## ADDED Requirements

### Requirement: Connection icon replaces text button and separate indicator
The header SHALL present the connection control as a single icon button, rather than a text-labeled button paired with a separate status indicator.

#### Scenario: Header layout
- **WHEN** the application window is shown
- **THEN** the header SHALL show one connection icon button rather than a "Connection" text button and a separate circular status indicator

### Requirement: Icon reflects cluster reachability
The connection icon SHALL show a connected color after a connection attempt succeeds or any Elasticsearch request completes, and a disconnected color after a connection attempt fails or any Elasticsearch request fails because the cluster could not be reached, for example because the connection was refused, timed out, or the host was not found. An error response returned by a reachable cluster, such as a missing index or an invalid query, SHALL NOT change the icon. The icon's color SHALL NOT be based on general internet or network connectivity.

#### Scenario: Successful connection
- **WHEN** the application successfully connects to the configured cluster
- **THEN** the connection icon SHALL show the connected color

#### Scenario: Failed connection attempt
- **WHEN** a connection attempt to the configured cluster fails
- **THEN** the connection icon SHALL show the disconnected color, regardless of whether the local machine has internet access

#### Scenario: Cluster becomes unreachable after connecting
- **WHEN** the application is connected and a later Elasticsearch request fails because the cluster cannot be reached
- **THEN** the connection icon SHALL show the disconnected color

#### Scenario: Cluster becomes reachable again
- **WHEN** the icon shows the disconnected color after a network-level failure and a later Elasticsearch request completes
- **THEN** the connection icon SHALL show the connected color

#### Scenario: Cluster returns an error response
- **WHEN** a request reaches the cluster and the cluster responds with an error, such as an index not being found
- **THEN** the connection icon SHALL keep its current color

### Requirement: Unreachability does not disconnect
A network-level request failure SHALL change only the icon. It SHALL NOT close the active connection or its SSH tunnel, clear data already loaded in the workspace, or show a disconnection notice.

#### Scenario: A request times out
- **WHEN** an Elasticsearch request times out while connected through an SSH tunnel
- **THEN** the icon SHALL show the disconnected color, the tunnel SHALL remain open, and data already shown in the workspace SHALL remain

### Requirement: Icon opens connection configuration
Activating the connection icon SHALL open the connection configuration dialog, matching the behavior of the control it replaces.

#### Scenario: Clicking the icon
- **WHEN** the user activates the connection icon
- **THEN** the connection configuration dialog SHALL open
