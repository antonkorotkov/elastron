/** Providers the assistant supports. Shared by the settings UI and the server. */
export const AI_PROVIDERS = ['openai', 'anthropic', 'google', 'custom']

export const AI_PROVIDER_LABELS = {
	openai: 'OpenAI',
	anthropic: 'Anthropic',
	google: 'Google Gemini',
	custom: 'Custom (OpenAI-compatible)',
}

export const isKnownProvider = provider => AI_PROVIDERS.includes(provider)

/** Whether a provider config has everything a request needs. */
export const isProviderUsable = config =>
	Boolean(
		config &&
			isKnownProvider(config.provider) &&
			config.apiKey?.trim() &&
			config.model?.trim() &&
			(config.provider !== 'custom' || config.baseUrl?.trim())
	)
