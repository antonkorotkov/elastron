## Purpose

Defines how Elastron stores, edits, and restores the user's saved Elasticsearch connection profiles, independent of any particular connection's live/active state.

## ADDED Requirements

### Requirement: Save a connection with no upper limit
The system SHALL persist every successfully tested connection to the saved-connections list, with no maximum count enforced.

#### Scenario: Saving an 11th connection
- **WHEN** a user successfully connects with a new connection profile and 10 connections are already saved
- **THEN** the new connection is added to the saved list and none of the existing 10 are removed

### Requirement: Duplicate connections are not re-saved
The system SHALL NOT add a connection to the saved list if an entry with identical configuration already exists.

#### Scenario: Reconnecting with unchanged settings
- **WHEN** a user successfully connects using settings identical to an already-saved connection
- **THEN** the saved-connections list is unchanged

### Requirement: Saved connections can be edited and removed
The system SHALL allow a saved connection to be replaced in place or deleted by the user.

#### Scenario: Editing a saved connection
- **WHEN** a user edits a saved connection's fields and saves
- **THEN** the entry at that position is replaced with the updated configuration and no other entries move

#### Scenario: Deleting a saved connection
- **WHEN** a user deletes a saved connection
- **THEN** that entry is removed from the list and no other entries are affected

### Requirement: Saved connections persist across app restarts
The system SHALL persist the saved-connections list to local encrypted storage and restore it on next launch.

#### Scenario: Restoring after restart
- **WHEN** the application launches
- **THEN** the previously saved connections are loaded and available for selection
