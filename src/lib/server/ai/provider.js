import { createOpenAI } from '@ai-sdk/openai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'

/**
 * Builds the language model for one request from the renderer's active
 * provider settings. Clients are created per request; nothing is cached, so
 * the key lives only as long as the request.
 */
export const createProviderModel = ({ provider, apiKey, model, baseUrl }) => {
	switch (provider) {
		case 'openai':
			return createOpenAI({ apiKey })(model)
		case 'anthropic':
			return createAnthropic({ apiKey })(model)
		case 'google':
			return createGoogleGenerativeAI({ apiKey })(model)
		case 'custom':
			return createOpenAICompatible({ name: 'custom', apiKey, baseURL: baseUrl })(model)
		default:
			throw new Error(`Unsupported AI provider: ${provider}`)
	}
}
