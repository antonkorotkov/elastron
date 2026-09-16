## ADDED Requirements

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
