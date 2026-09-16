import { getStorage, setStorage } from '../utils/storage.js'

import { AI_PROVIDERS, isKnownProvider } from '../ai/providers.js'

export { AI_PROVIDERS, AI_PROVIDER_LABELS, isProviderUsable } from '../ai/providers.js'

const PROVIDER_FIELDS = {
	openai: ['apiKey', 'model'],
	anthropic: ['apiKey', 'model'],
	google: ['apiKey', 'model'],
	custom: ['apiKey', 'model', 'baseUrl'],
}

const emptyProvider = provider =>
	Object.fromEntries(PROVIDER_FIELDS[provider].map(field => [field, '']))

export const defaultAiSettings = () => ({
	activeProvider: null,
	providers: Object.fromEntries(
		AI_PROVIDERS.map(provider => [provider, emptyProvider(provider)])
	),
})

/**
 * Lays persisted data over the defaults, keeping only known providers and
 * string fields, so a hand-edited or older store can't break the form.
 */
export const normalizeAiSettings = data => {
	const settings = defaultAiSettings()
	if (!data || typeof data !== 'object') return settings

	if (isKnownProvider(data.activeProvider)) {
		settings.activeProvider = data.activeProvider
	}

	for (const provider of AI_PROVIDERS) {
		const stored = data.providers?.[provider]
		if (!stored || typeof stored !== 'object') continue
		for (const field of PROVIDER_FIELDS[provider]) {
			if (typeof stored[field] === 'string') {
				settings.providers[provider][field] = stored[field]
			}
		}
	}

	return settings
}

/** The active provider's id and fields, or null when none is active. */
export const getActiveProviderConfig = settings => {
	const provider = settings?.activeProvider
	if (!isKnownProvider(provider)) return null
	return { provider, ...settings.providers[provider] }
}

/** Loads the persisted settings into the store. Called once at startup. */
export const hydrateAiSettings = async store => {
	store.dispatch('aiSettings/hydrate', await getStorage('aiSettings', null))
}

export const aiSettings = store => {
	// aiSettingsLoaded turns true once the stored settings are in. Until then
	// the defaults are placeholders, not the user's settings, and nothing may
	// be saved over the stored ones.
	store.on('@init', () => ({ aiSettings: defaultAiSettings(), aiSettingsLoaded: false }))

	// Hydration restores what is already on disk, so it doesn't write back.
	store.on('aiSettings/hydrate', (_state, data) => ({
		aiSettings: normalizeAiSettings(data),
		aiSettingsLoaded: true,
	}))

	// The Settings dialog edits a draft and commits it here when the user
	// saves, like the app's other dialogs. The whole draft is replaced and
	// written to disk at once.
	store.on('aiSettings/save', (_state, draft) => {
		const settings = normalizeAiSettings(draft)
		setStorage('aiSettings', settings)
		return { aiSettings: settings, aiSettingsLoaded: true }
	})
}
