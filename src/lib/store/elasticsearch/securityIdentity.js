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
	store.on('@init', initial)

	store.on('connected', () => {
		store.dispatch('security/identity/fetch')
	})

	store.on('disconnected', initial)

	store.on('security/identity/update', (state, data) => ({
		securityIdentity: { ...state.securityIdentity, ...data },
	}))

	store.on('security/identity/fetch', async state => {
		store.dispatch('security/identity/update', { loading: true })
		try {
			const api = new API(state.connection, state.app?.windowId)
			const me = await api.whoAmI()
			store.dispatch('security/identity/update', {
				username: me?.username ?? null,
				roles: Array.isArray(me?.roles) ? me.roles : [],
				reserved: Boolean(me?.metadata?._reserved),
				loading: false,
				cause: null,
			})
		} catch (err) {
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
