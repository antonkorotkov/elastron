import API from '../../api/elasticsearch'
import { classifySecurityError } from '../../security/causes.js'

/**
 * Who the active connection authenticates as.
 *
 * This is not a privilege probe. Elastron deliberately does not ask the cluster
 * what the account may do; it attempts an operation and names the cause when
 * refused. Identity is needed for a different reason: Elasticsearch will
 * happily let an account strip its own roles and lock itself out, so the app
 * has to know which account that is in order to refuse.
 */
const initial = () => ({
	securityIdentity: {
		username: null,
		roles: [],
		reserved: false,
		loading: false,
		// Set when the cluster would not say who we are, e.g. security is off.
		cause: null,
	},
})

export const securityIdentity = store => {
	let session = 0

	store.on('@init', initial)

	// Cleared first so the guards never judge the new cluster by the previous
	// cluster's account.
	store.on('connected', () => {
		session++
		store.dispatch('security/identity/reset')
		store.dispatch('security/identity/fetch')
	})

	store.on('disconnected', () => {
		session++
		return initial()
	})

	store.on('security/identity/reset', initial)

	store.on('security/identity/update', (state, data) => ({
		securityIdentity: { ...state.securityIdentity, ...data },
	}))

	store.on('security/identity/fetch', async state => {
		const started = session
		store.dispatch('security/identity/update', { loading: true })
		try {
			const api = new API(state.connection, state.app?.windowId)
			const me = await api.whoAmI()
			if (started !== session) return
			store.dispatch('security/identity/update', {
				username: me?.username ?? null,
				roles: Array.isArray(me?.roles) ? me.roles : [],
				reserved: Boolean(me?.metadata?._reserved),
				loading: false,
				cause: null,
			})
		} catch (err) {
			if (started !== session) return
			// A cluster with security disabled cannot say who we are, and that is
			// not an error worth surfacing on its own; the surfaces report it.
			store.dispatch('security/identity/update', {
				username: null,
				roles: [],
				reserved: false,
				loading: false,
				cause: classifySecurityError(err),
			})
		}
	})
}
