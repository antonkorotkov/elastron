import AiIntegrationSettings from './AiIntegrationSettings.svelte'

/**
 * The sections shown in the Settings dialog, in display order. Adding a
 * section means appending `{ id, title, component }` here; no existing
 * section has to change.
 */
export const settingsSections = [
	{ id: 'ai', title: 'AI Integration', component: AiIntegrationSettings },
]
