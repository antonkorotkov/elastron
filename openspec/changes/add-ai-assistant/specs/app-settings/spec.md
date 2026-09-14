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

### Requirement: AI Integration section
The Settings panel SHALL include an "AI Integration" section that hosts the assistant's provider, API key, and model configuration, as defined by the ai-assistant capability.

#### Scenario: Configuring AI settings
- **WHEN** the user selects the AI Integration section
- **THEN** the user SHALL be able to view and edit the global AI provider, API key, and model settings from within the Settings panel

### Requirement: Extensible section list
The Settings panel's section list SHALL be able to hold more than one section without any existing section's content being redesigned to accommodate another.

#### Scenario: Two sections coexist
- **WHEN** the Settings panel has more than one section defined
- **THEN** each section SHALL appear as its own entry in the vertical list, and selecting one section SHALL NOT alter another section's content
