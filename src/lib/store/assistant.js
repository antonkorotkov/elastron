import { getStorage, setStorage } from '../utils/storage.js'
import { endpointOf } from '../utils/endpoint.js'

/** The most messages kept per endpoint; older ones are dropped on write. */
export const MAX_STORED_MESSAGES = 200

// Conversations are keyed by the cluster a connection reaches.
export { endpointOf }

// electron-store reads dots in a key as a nested path, and hostnames have
// dots, so the endpoint is base64url-encoded, which never contains one.
const toBase64Url = text =>
	btoa(String.fromCharCode(...new TextEncoder().encode(text)))
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=+$/, '')

export const historyKey = endpoint => `assistantHistory_${toBase64Url(endpoint)}`

/**
 * Keeps the most recent messages up to the cap, starting at a user message so
 * a restored conversation never opens partway through a reply.
 */
export const trimMessages = (messages, max = MAX_STORED_MESSAGES) => {
	if (!Array.isArray(messages)) return []
	if (messages.length <= max) return messages
	const kept = messages.slice(-max)
	const firstUser = kept.findIndex(message => message.role === 'user')
	return firstUser === -1 ? kept : kept.slice(firstUser)
}

const persist = (endpoint, messages) => {
	if (endpoint) setStorage(historyKey(endpoint), messages)
}

export const assistant = store => {
	store.on('@init', () => ({
		assistant: { open: false, endpoint: null, messages: [] },
	}))

	store.on('assistant/open', state => ({ assistant: { ...state.assistant, open: true } }))
	store.on('assistant/close', state => ({ assistant: { ...state.assistant, open: false } }))
	store.on('assistant/toggle', state => ({
		assistant: { ...state.assistant, open: !state.assistant.open },
	}))

	/** Replaces the conversation, trimmed to the cap, and persists it. */
	store.on('assistant/setMessages', (state, messages) => {
		const trimmed = trimMessages(messages)
		persist(state.assistant.endpoint, trimmed)
		return { assistant: { ...state.assistant, messages: trimmed } }
	})

	/** Appends one message, trimmed to the cap, and persists it. */
	store.on('assistant/append', (state, message) => {
		const trimmed = trimMessages([...state.assistant.messages, message])
		persist(state.assistant.endpoint, trimmed)
		return { assistant: { ...state.assistant, messages: trimmed } }
	})

	store.on('assistant/clear', state => {
		persist(state.assistant.endpoint, [])
		return { assistant: { ...state.assistant, messages: [] } }
	})

	store.on('assistant/loaded', (state, { endpoint, messages }) => {
		// A slower load for an endpoint the window has since left is dropped.
		if (endpoint !== endpointOf(state.connection)) return
		return { assistant: { ...state.assistant, endpoint, messages: trimMessages(messages) } }
	})

	// The conversation follows the window's connection on every change to it,
	// not only when a connection attempt ends: Quick Connect updates the
	// connection before opening a tunnel, and a failed tunnel ends without a
	// connected or disconnected event.
	const load = async state => {
		const endpoint = endpointOf(state.connection)
		if (!endpoint || endpoint === state.assistant.endpoint) return
		const messages = await getStorage(historyKey(endpoint), [])
		store.dispatch('assistant/loaded', { endpoint, messages })
	}

	store.on('@changed', (state, changes) => {
		if ('connection' in changes) load(state)
	})
}
