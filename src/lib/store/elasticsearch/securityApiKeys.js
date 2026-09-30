import API from '../../api/elasticsearch'
import { createSecurityList, toApiKeyEntries } from './securityList.js'
import { CAUSE, classifySecurityError } from '../../security/causes.js'

const list = createSecurityList({
	key: 'securityApiKeys',
	event: 'security/api-keys',
	// Elasticsearch has no delete for API keys. Invalidating one leaves it in
	// the listing until the cluster's own retention period expires it, seven
	// days by default, so the listing fills with rows nothing can act on. They
	// are hidden unless asked for.
	extra: { showInvalidated: false },
	load: async state => {
		const api = new API(state.connection, state.app?.windowId)
		try {
			return { entries: toApiKeyEntries(await api.getSecurityApiKeys(false)), scope: 'all' }
		} catch (err) {
			// API keys sit on their own privilege tier. An account holding only
			// `manage_own_api_key` is refused the unscoped listing but may ask
			// for its own keys, so this is a fallback rather than a failure.
			if (classifySecurityError(err) !== CAUSE.PRIVILEGE) throw err
			return { entries: toApiKeyEntries(await api.getSecurityApiKeys(true)), scope: 'own' }
		}
	},
})

export const securityApiKeys = store => {
	list(store)

	store.on('security/api-keys/create', async (state, { body, onCreated }) => {
		try {
			const api = new API(state.connection, state.app?.windowId)
			const created = await api.createSecurityApiKey(body)
			// The secret exists only in this response. It is handed to the
			// caller to show once and is never put into the store.
			if (typeof onCreated === 'function') onCreated(created)
			store.dispatch('security/api-keys/fetch')
		} catch (err) {
			store.dispatch('notification/add', {
				type: 'error',
				message: err?.message || 'The API key could not be created.',
			})
		}
	})

	store.on('security/api-keys/invalidate', async (state, { id, name }) => {
		try {
			const api = new API(state.connection, state.app?.windowId)
			await api.invalidateSecurityApiKey(id)
			store.dispatch('notification/add', {
				type: 'success',
				message: `API key "${name || id}" invalidated.`,
			})
			store.dispatch('security/api-keys/fetch')
		} catch (err) {
			store.dispatch('notification/add', {
				type: 'error',
				message: err?.message || 'The API key could not be invalidated.',
			})
		}
	})
}
