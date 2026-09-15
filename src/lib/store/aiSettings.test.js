import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createStoreon } from 'storeon'
import { getStorage, setStorage } from '../utils/storage.js'
import {
	aiSettings,
	defaultAiSettings,
	normalizeAiSettings,
	getActiveProviderConfig,
	isProviderUsable,
	hydrateAiSettings,
} from './aiSettings'

vi.mock('../utils/storage.js', () => ({
	setStorage: vi.fn(),
	getStorage: vi.fn(),
}))

describe('aiSettings store module', () => {
	let store

	beforeEach(() => {
		setStorage.mockReset()
		store = createStoreon([aiSettings])
	})

	const settings = () => store.get().aiSettings
	const draft = patch => {
		const value = defaultAiSettings()
		value.activeProvider = patch.activeProvider ?? null
		for (const [provider, fields] of Object.entries(patch.providers ?? {})) Object.assign(value.providers[provider], fields)
		return value
	}

	it('starts with no active provider and empty fields', () => {
		expect(settings()).toEqual(defaultAiSettings())
		expect(settings().providers.custom).toEqual({ apiKey: '', model: '', baseUrl: '' })
	})

	it('is not loaded until hydrated or saved', () => {
		expect(store.get().aiSettingsLoaded).toBe(false)
		store.dispatch('aiSettings/hydrate', null)
		expect(store.get().aiSettingsLoaded).toBe(true)
	})

	it('hydrates from stored data without writing it back', () => {
		store.dispatch('aiSettings/hydrate', {
			activeProvider: 'anthropic',
			providers: { anthropic: { apiKey: 'sk-ant', model: 'claude-opus-5' } },
		})
		expect(settings().activeProvider).toBe('anthropic')
		expect(settings().providers.anthropic).toEqual({ apiKey: 'sk-ant', model: 'claude-opus-5' })
		expect(setStorage).not.toHaveBeenCalled()
	})

	it('saves a whole draft and writes it at once', () => {
		store.dispatch('aiSettings/save', draft({ activeProvider: 'openai', providers: { openai: { apiKey: 'sk-1', model: 'gpt-5.1' } } }))
		expect(settings().activeProvider).toBe('openai')
		expect(settings().providers.openai).toEqual({ apiKey: 'sk-1', model: 'gpt-5.1' })
		expect(setStorage).toHaveBeenCalledTimes(1)
		expect(setStorage).toHaveBeenCalledWith('aiSettings', settings())
	})

	it('keeps other providers when a save switches the active one', () => {
		const both = { openai: { apiKey: 'sk-1', model: 'gpt-5.1' }, anthropic: { apiKey: 'sk-ant', model: 'claude-opus-5' } }
		store.dispatch('aiSettings/save', draft({ activeProvider: 'openai', providers: both }))
		store.dispatch('aiSettings/save', draft({ activeProvider: 'anthropic', providers: both }))
		expect(settings().activeProvider).toBe('anthropic')
		expect(settings().providers.openai).toEqual({ apiKey: 'sk-1', model: 'gpt-5.1' })
	})

	it('normalizes what it saves', () => {
		store.dispatch('aiSettings/save', { activeProvider: 'bogus', providers: { openai: { apiKey: 5, baseUrl: 'x' }, bogus: {} } })
		expect(settings()).toEqual(defaultAiSettings())
	})
})

describe('normalizeAiSettings', () => {
	it('falls back to defaults for missing or malformed data', () => {
		expect(normalizeAiSettings(null)).toEqual(defaultAiSettings())
		expect(normalizeAiSettings('nope')).toEqual(defaultAiSettings())
		expect(normalizeAiSettings({ activeProvider: 'bogus', providers: { openai: 'x' } })).toEqual(defaultAiSettings())
	})
})

describe('active provider helpers', () => {
	const withActive = (provider, fields) => {
		const settings = defaultAiSettings()
		settings.activeProvider = provider
		Object.assign(settings.providers[provider], fields)
		return settings
	}

	it('returns null without an active provider', () => {
		expect(getActiveProviderConfig(defaultAiSettings())).toBe(null)
		expect(isProviderUsable(null)).toBe(false)
	})

	it('needs a key and a model', () => {
		expect(isProviderUsable(getActiveProviderConfig(withActive('openai', { apiKey: 'sk', model: '' })))).toBe(false)
		expect(isProviderUsable(getActiveProviderConfig(withActive('openai', { apiKey: ' ', model: 'gpt' })))).toBe(false)
		expect(isProviderUsable(getActiveProviderConfig(withActive('openai', { apiKey: 'sk', model: 'gpt' })))).toBe(true)
	})

	it('also needs a base URL for the custom provider', () => {
		const config = getActiveProviderConfig(withActive('custom', { apiKey: 'sk', model: 'llama3' }))
		expect(config.provider).toBe('custom')
		expect(isProviderUsable(config)).toBe(false)
		expect(isProviderUsable({ ...config, baseUrl: 'http://localhost:11434/v1' })).toBe(true)
	})
})

describe('hydrateAiSettings', () => {
	it('loads the stored settings into the store at startup', async () => {
		getStorage.mockResolvedValue({
			activeProvider: 'google',
			providers: { google: { apiKey: 'g-key', model: 'gemini-3-pro' } },
		})
		const store = createStoreon([aiSettings])

		await hydrateAiSettings(store)

		expect(getStorage).toHaveBeenCalledWith('aiSettings', null)
		expect(store.get().aiSettings.activeProvider).toBe('google')
		expect(store.get().aiSettings.providers.google).toEqual({ apiKey: 'g-key', model: 'gemini-3-pro' })
	})

	it('keeps defaults when nothing is stored', async () => {
		getStorage.mockResolvedValue(null)
		const store = createStoreon([aiSettings])
		await hydrateAiSettings(store)
		expect(store.get().aiSettings).toEqual(defaultAiSettings())
	})
})
