## Purpose

Lets users converse with an AI assistant that can inspect, and with explicit approval modify, the connected Elasticsearch cluster on their behalf, and hand the queries it builds to the rest of the app, using an AI provider and model the user configures themselves.

## ADDED Requirements

### Requirement: Assistant panel availability
The system SHALL provide a persistent chat panel that can be opened and closed from any workspace view, scoped to the window's currently active connection.

#### Scenario: Opening the assistant from any page
- **WHEN** the user activates the assistant control while viewing any workspace page (Dashboard, Monitoring, Search, Playground, or an index view)
- **THEN** the assistant panel opens without navigating away from the current page

### Requirement: Provider and model configuration
The system SHALL let the user store an API key and a model identifier, entered as free text, for each supported provider: OpenAI, Anthropic, Google Gemini, and a custom OpenAI-compatible endpoint, which additionally takes a base URL. The user SHALL choose which one provider is active. The assistant SHALL use only the active provider's key and model. Changing the active provider SHALL NOT erase the key or model stored for any other provider.

#### Scenario: No provider configured
- **WHEN** the user opens the assistant panel and no provider is active, or the active provider has no API key or no model
- **THEN** the system SHALL prompt the user to configure a provider before any message can be sent

#### Scenario: Switching providers keeps stored keys
- **WHEN** the user has keys stored for OpenAI and Anthropic, switches the active provider from OpenAI to Anthropic, and later switches back
- **THEN** the OpenAI key and model SHALL still be stored and SHALL be used again without re-entry

### Requirement: Credential handling
The system SHALL persist API keys only in the application's encrypted local storage, and SHALL NOT send an API key to any destination other than the active provider's API. API keys SHALL NOT appear in error messages shown to the user or in any log.

#### Scenario: Provider rejects the request
- **WHEN** the active provider rejects a request, for example because the key is invalid
- **THEN** the system SHALL show the failure in the conversation without revealing the API key

### Requirement: Cluster context
The system SHALL give the assistant the connected cluster's version and, when the cluster reports it, its build flavor, so the queries and requests it proposes are valid for that cluster.

#### Scenario: Version is part of the request to the provider
- **WHEN** the user sends a message while connected to a cluster reporting version 9.1.0
- **THEN** the request sent to the active provider SHALL include that version as context

### Requirement: Read-only actions run automatically
The system SHALL execute assistant-requested actions that only read cluster state, such as listing indices, running a search, counting documents, validating a query, or reading a mapping, without requiring explicit user confirmation.

#### Scenario: Assistant answers a question using a read action
- **WHEN** the user asks a question the assistant can answer by reading cluster state
- **THEN** the assistant SHALL perform the read and present the answer without pausing for approval

### Requirement: Mutating actions require explicit confirmation
The system SHALL NOT execute any assistant-requested action that creates, modifies, or deletes cluster state until the user explicitly approves that specific action. This includes creating, deleting, opening, closing, cloning, or wiping an index, indexing, updating, or deleting a document, changing mappings, settings, or aliases, and any arbitrary request whose effect the system does not classify, which SHALL be treated as mutating regardless of its HTTP method. Each proposed action SHALL be presented with its operation, its target, and the full request it will send.

#### Scenario: Assistant proposes a destructive action
- **WHEN** the assistant determines that fulfilling the user's request requires deleting an index
- **THEN** the system SHALL present the proposed deletion, naming the target index, and SHALL NOT delete anything until the user explicitly confirms

#### Scenario: User declines a proposed action
- **WHEN** the user declines a proposed mutating action
- **THEN** the system SHALL NOT execute it, and the assistant SHALL be told the action was declined

#### Scenario: Arbitrary request is confirmed even when it only reads
- **WHEN** the assistant sends an arbitrary request through the generic request action, even one using the GET method
- **THEN** the system SHALL present it for confirmation before sending it

### Requirement: Tool result size is bounded
The system SHALL cap the cluster data included in a single tool result returned to the AI provider at a fixed ceiling. A request for more than the ceiling SHALL be reduced to the ceiling. A truncated result SHALL state that it was truncated, so the assistant can tell the user its answer is based on partial data.

#### Scenario: Broad search over a large result set
- **WHEN** the assistant runs a search that matches more documents than the ceiling
- **THEN** the result sent to the AI provider SHALL contain at most the ceiling and SHALL be marked as truncated

#### Scenario: Listing a large cluster
- **WHEN** the assistant lists indices on a cluster with more indices than the ceiling
- **THEN** the result sent to the AI provider SHALL contain at most the ceiling and SHALL be marked as truncated

### Requirement: Query handoff
When the assistant proposes a search query or an Elasticsearch request, the system SHALL present it with actions to load it into the Playground and to copy it. A proposed search query SHALL additionally offer an action to open it in the Search view.

#### Scenario: Opening a proposed search in the Search view
- **WHEN** the user activates open-in-search on a proposed search query targeting the index `products`
- **THEN** the system SHALL open a new search tab, as defined by the search-tabs capability, holding that index and query, SHALL move the user to the Search view with that tab active, and SHALL NOT run the query until the user runs it

#### Scenario: Search tab limit reached
- **WHEN** the user activates open-in-search while the maximum number of search tabs is open
- **THEN** the system SHALL refuse and tell the user why, as the search-tabs capability defines for adding a tab

#### Scenario: Loading a proposed request into the Playground
- **WHEN** the user activates load-into-playground on a proposed request
- **THEN** the Playground draft's method, path, body, and headers SHALL be replaced with the request's, as the playground capability defines for loading a template, and the user SHALL be moved to the Playground view

#### Scenario: A non-search request is not offered to Search
- **WHEN** the assistant proposes a request that is not a search, such as a mapping update
- **THEN** the system SHALL offer load-into-playground and copy, and SHALL NOT offer open-in-search

### Requirement: Conversation persistence and retention
The system SHALL persist one ongoing conversation per cluster endpoint, identified by host, port, and user, and SHALL restore it whenever a connection to that endpoint becomes active. Saved connections that share an endpoint SHALL share its conversation. The system SHALL automatically trim each persisted conversation to at most a bounded number of most-recent messages.

#### Scenario: Reconnecting restores the conversation
- **WHEN** the user connects to an endpoint previously used with the assistant
- **THEN** the assistant panel SHALL show that endpoint's prior conversation, up to the retained message limit

#### Scenario: History exceeds the retention limit
- **WHEN** an endpoint's conversation grows beyond the retained message limit
- **THEN** the oldest messages SHALL be dropped from storage so the stored conversation stays at or below the limit

### Requirement: Bounded model context
The system SHALL bound what each request sends to the AI provider independently of the stored conversation. Tool results older than the most recent few messages SHALL be omitted from the request, while the assistant's own replies SHALL be kept. Only a bounded number of the most recent messages SHALL be sent. Pruning SHALL NOT change the stored conversation or what the panel displays.

#### Scenario: Old tool results are not resent
- **WHEN** the user sends a message in a conversation whose earlier turns ran searches
- **THEN** the request sent to the AI provider SHALL NOT include the results of those earlier searches, and SHALL include the assistant's earlier replies

#### Scenario: Long conversation
- **WHEN** the stored conversation holds more messages than the context bound
- **THEN** the request sent to the AI provider SHALL include only the most recent messages up to the bound

#### Scenario: Display is unaffected
- **WHEN** a request has been sent with pruned context
- **THEN** the panel SHALL still display every stored message, including the earlier tool results

### Requirement: Manual history clearing
The system SHALL allow the user to clear the active endpoint's stored conversation on demand.

#### Scenario: User clears history
- **WHEN** the user chooses to clear the assistant history
- **THEN** the system SHALL remove the stored conversation for the active endpoint, and the panel SHALL show an empty conversation

### Requirement: No assistant data in analytics
The system SHALL NOT send conversation content, tool calls or their results, provider names, model identifiers, or API keys to analytics. Using the assistant SHALL NOT produce any analytics event beyond those the usage-analytics capability defines.

#### Scenario: A full assistant session
- **WHEN** the user configures a provider, chats, approves an action, and hands a query to Search
- **THEN** no analytics event SHALL be sent for any of it
