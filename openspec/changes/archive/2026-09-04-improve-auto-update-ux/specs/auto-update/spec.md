## Purpose

Defines how Elastron checks for, downloads, and installs new versions published as GitHub releases, and what feedback the user gets at each stage of that process.

## ADDED Requirements

### Requirement: Update checks are performed on demand
The system SHALL perform an actual update check against GitHub releases whenever a check is triggered, whether from app launch, the "Check for Updates" menu item, or any other UI-initiated trigger. A UI-initiated trigger SHALL NOT be a no-op.

#### Scenario: Triggering a check from the UI
- **WHEN** the user triggers an update check from anywhere in the UI
- **THEN** the system performs a real check against the update feed, rather than silently doing nothing

#### Scenario: Automatic check on launch
- **WHEN** the app starts
- **THEN** the system checks for updates without showing a dialog if none is available or an error occurs

### Requirement: User confirms before downloading an update
When an update is found, the system SHALL ask the user whether to download it before starting the download.

#### Scenario: Update found
- **WHEN** an update check finds a newer version
- **THEN** the user is shown a choice to download the update now or defer it
- **AND** no download begins unless the user chooses to download

### Requirement: Download progress is visible while downloading
While an update is downloading, the system SHALL show the user ongoing progress, rather than no feedback, until the download completes or fails.

#### Scenario: Download in progress
- **WHEN** the user chooses to download an available update
- **THEN** the system displays a progress indicator reflecting the download's completion percentage until it finishes

#### Scenario: Download completes
- **WHEN** the download finishes
- **THEN** the progress indicator is no longer shown

### Requirement: User confirms before restarting to install
When a downloaded update is ready to install, the system SHALL ask the user whether to restart and install it now.

#### Scenario: Download finished
- **WHEN** an update finishes downloading
- **THEN** the user is shown a choice to restart and install now or defer it

### Requirement: Restarting to install remains available after deferring
If the user defers restarting after a download completes, the system SHALL continue to offer a way to restart and install for the remainder of the session, without requiring another update check.

#### Scenario: User defers the restart prompt
- **WHEN** the user defers restarting after being prompted to install a downloaded update
- **THEN** the system continues to offer a visible way to restart and install the update
- **AND** choosing it restarts the app and installs the update
