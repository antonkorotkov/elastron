## Purpose

Lets users converse with an AI assistant that can inspect, and with explicit approval modify, the connected Elasticsearch cluster on their behalf, using an AI provider and model the user configures themselves.

## ADDED Requirements

### Requirement: Assistant panel availability
The system SHALL provide a persistent chat panel that can be opened and closed from any workspace view, scoped to the window's currently active connection.

#### Scenario: Opening the assistant from any page
- **WHEN** the user activates the assistant control while viewing any workspace page (Dashboard, Monitoring, Search, Playground, or an index view)
- **THEN** the assistant panel opens without navigating away from the current page

### Requirement: Provider and model configuration
The system SHALL allow the user to configure, per AI provider (OpenAI, Anthropic, Google Gemini, or a custom OpenAI-compatible endpoint), an API key and a model identifier entered as free text.

#### Scenario: No provider configured
- **WHEN** the user opens the assistant panel and no AI provider is configured, either globally or for the active connection
- **THEN** the system SHALL prompt the user to configure a provider before any message can be sent

### Requirement: Per-connection override
The system SHALL allow a saved connection to override the global AI provider, API key, and model with its own. When a connection defines an override, the assistant SHALL use the connection's settings instead of the global settings while that connection is active.

#### Scenario: Connection-specific settings take precedence
- **WHEN** the active connection has its own AI provider settings configured
- **THEN** the assistant SHALL use the connection's settings rather than the global settings for every request made while that connection is active

### Requirement: Read-only actions run automatically
The system SHALL execute assistant-requested actions that only read cluster state (for example, listing indices, running a search, retrieving a mapping, or reading cluster health) without requiring explicit user confirmation.

#### Scenario: Assistant answers a question using a read action
- **WHEN** the user asks a question the assistant can answer by reading cluster state
- **THEN** the assistant SHALL perform the read and present the answer without pausing for approval

### Requirement: Mutating actions require explicit confirmation
The system SHALL NOT execute any assistant-requested action that creates, modifies, or deletes cluster state — including creating or deleting an index, indexing, updating or deleting a document, changing mappings or settings, or sending an arbitrary write request — until the user explicitly approves that specific action. Each proposed mutating action SHALL be presented with enough detail, at minimum the operation and its target, for the user to understand what will happen before approving it.

#### Scenario: Assistant proposes a destructive action
- **WHEN** the assistant determines that fulfilling the user's request requires deleting an index
- **THEN** the system SHALL present the proposed deletion, naming the target index, and SHALL NOT delete anything until the user explicitly confirms

#### Scenario: User declines a proposed action
- **WHEN** the user declines or dismisses a proposed mutating action
- **THEN** the system SHALL NOT execute it, and the assistant SHALL treat the request as not fulfilled

### Requirement: Tool result size is bounded by default
The system SHALL cap the amount of cluster data, such as search hits or document bodies, included in a single tool result returned to the AI provider, unless the user's request explicitly requires a larger result.

#### Scenario: Broad request over a large result set
- **WHEN** the assistant runs a search that matches a large number of documents
- **THEN** the data included in the result sent to the AI provider SHALL be truncated to a bounded size rather than including every matching document

### Requirement: Conversation persistence and retention
The system SHALL persist one ongoing conversation per connection to local storage, restored when that connection becomes active again. The system SHALL automatically trim a connection's persisted conversation to at most a bounded number of most-recent messages, so stored history for a connection does not grow without bound.

#### Scenario: Reopening a connection restores its conversation
- **WHEN** the user switches back to a connection previously used with the assistant
- **THEN** the assistant panel SHALL show that connection's prior conversation, up to the retained message limit

#### Scenario: History exceeds the retention limit
- **WHEN** a connection's conversation grows beyond the retained message limit
- **THEN** the oldest messages SHALL be dropped from storage so the stored conversation stays at or below the limit

### Requirement: Manual history clearing
The system SHALL allow the user to clear a connection's stored conversation on demand.

#### Scenario: User clears history
- **WHEN** the user chooses to clear the active connection's assistant history
- **THEN** the system SHALL remove the stored conversation for that connection, and the panel SHALL show an empty conversation
