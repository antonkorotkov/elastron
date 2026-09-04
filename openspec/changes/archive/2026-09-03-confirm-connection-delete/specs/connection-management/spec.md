## MODIFIED Requirements

### Requirement: Saved connections can be edited and removed
The system SHALL allow a saved connection to be replaced in place or deleted by the user. Deletion SHALL require explicit user confirmation, naming the connection being deleted, before it is removed.

#### Scenario: Editing a saved connection
- **WHEN** a user edits a saved connection's fields and saves
- **THEN** the entry at that position is replaced with the updated configuration and no other entries move

#### Scenario: Deleting a saved connection
- **WHEN** a user clicks delete on a saved connection and confirms the prompt
- **THEN** that entry is removed from the list and no other entries are affected

#### Scenario: Cancelling a delete
- **WHEN** a user clicks delete on a saved connection and dismisses or cancels the confirmation prompt
- **THEN** the saved-connections list is unchanged
