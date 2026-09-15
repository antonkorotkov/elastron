## Purpose

Provides a single, extensible place for application-level preferences, organized into sections so new settings areas can be added later without redesigning the surface.

## ADDED Requirements

### Requirement: Settings entry point
The system SHALL provide a control in the application header that opens the Settings panel.

#### Scenario: Opening settings
- **WHEN** the user activates the settings control in the header
- **THEN** the Settings panel opens

### Requirement: Sectioned layout
The Settings panel SHALL organize its content into named sections, presented as a vertical list the user can switch between, with exactly one section's content visible at a time.

#### Scenario: Switching sections
- **WHEN** the user selects a different settings section from the vertical list
- **THEN** the panel SHALL display that section's content in place of the previous section's, without closing the panel

### Requirement: Explicit save
Changes made in the Settings panel SHALL take effect only when the user saves them, as in the application's other dialogs. The panel SHALL offer Cancel and Save actions styled like those dialogs. Saving SHALL commit the changes of every section; canceling, pressing Escape, or clicking outside the panel SHALL discard them.

#### Scenario: Saving settings
- **WHEN** the user changes a setting and activates Save
- **THEN** the change SHALL take effect, SHALL be persisted, and the panel SHALL close

#### Scenario: Canceling settings
- **WHEN** the user changes a setting and activates Cancel
- **THEN** the setting SHALL keep its previous value and the panel SHALL close

#### Scenario: Settings opened before they finish loading
- **WHEN** the user opens the Settings panel before the stored settings have loaded, and activates Save
- **THEN** the panel SHALL show that settings are loading, and saving SHALL NOT replace the stored settings

### Requirement: AI Integration section
The Settings panel SHALL include an "AI Integration" section where the user chooses the active AI provider and, for each provider, views and edits its API key and model, plus the base URL for the custom provider, as defined by the ai-assistant capability. API keys SHALL be masked when displayed.

#### Scenario: Configuring AI settings
- **WHEN** the user selects the AI Integration section
- **THEN** the user SHALL be able to choose the active provider and edit each provider's key and model from within the Settings panel

#### Scenario: Keys are masked
- **WHEN** the AI Integration section shows a stored API key
- **THEN** the key SHALL be displayed masked rather than in plain text

### Requirement: Extensible section list
The Settings panel's section list SHALL be able to hold more than one section without any existing section's content being redesigned to accommodate another.

#### Scenario: Two sections coexist
- **WHEN** the Settings panel has more than one section defined
- **THEN** each section SHALL appear as its own entry in the vertical list, and selecting one section SHALL NOT alter another section's content
