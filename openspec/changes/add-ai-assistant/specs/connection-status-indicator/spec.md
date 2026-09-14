## Purpose

Gives the user a persistent, at-a-glance signal of whether the application is actually connected to the configured Elasticsearch cluster, replacing a general internet-connectivity indicator that did not reflect cluster reachability.

## ADDED Requirements

### Requirement: Connection icon replaces text button and separate indicator
The header SHALL present the connection control as a single icon button, rather than a text-labeled button paired with a separate status indicator.

#### Scenario: Header layout
- **WHEN** the application window is shown
- **THEN** the header SHALL show one connection icon button rather than a "Connection" text button and a separate circular status indicator

### Requirement: Icon reflects cluster connection status
The connection icon SHALL be colored to indicate whether the application is currently connected to the configured Elasticsearch cluster: one color when connected, a different color when not connected. The icon's color SHALL NOT be based on general internet or network connectivity.

#### Scenario: Cluster reachable
- **WHEN** the application successfully connects to the configured cluster
- **THEN** the connection icon SHALL show the connected color

#### Scenario: Cluster unreachable or disconnected
- **WHEN** the application fails to connect to, or becomes disconnected from, the configured cluster
- **THEN** the connection icon SHALL show the disconnected color, regardless of whether the local machine has internet access

### Requirement: Icon opens connection configuration
Activating the connection icon SHALL open the connection configuration dialog, matching the behavior of the control it replaces.

#### Scenario: Clicking the icon
- **WHEN** the user activates the connection icon
- **THEN** the connection configuration dialog SHALL open
