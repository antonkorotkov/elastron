import API from '../../api/elasticsearch'
import { createSecurityList, toUserEntries } from './securityList.js'
import { refuseUserDelete, refuseUserRoleChange } from '../../workspace/security/guards.js'

const list = createSecurityList({
	key: 'securityUsers',
	event: 'security/users',
	load: async state => {
		const api = new API(state.connection, state.app?.windowId)
		return { entries: toUserEntries(await api.getSecurityUsers()) }
	},
})

const fail = (store, err) =>
	store.dispatch('notification/add', {
		type: 'error',
		message: err?.message || 'The request failed.',
	})

const done = (store, message) => {
	store.dispatch('notification/add', { type: 'success', message })
	store.dispatch('security/users/fetch')
}

export const securityUsers = store => {
	list(store)

	store.on('security/users/put', async (state, { username, body, isNew }) => {
		// The guard runs here rather than only in the dialog, so no path can
		// reach the cluster without it.
		const catalogue = Object.fromEntries(
			(state.securityRoles?.entries || []).map(r => [r.name, r])
		)
		const refusal = refuseUserRoleChange(username, body?.roles, state.securityIdentity, catalogue)
		if (refusal) {
			store.dispatch('notification/add', { type: 'error', message: refusal })
			return
		}

		try {
			const api = new API(state.connection, state.app?.windowId)
			await api.putSecurityUser(username, body)
			done(store, `User "${username}" ${isNew ? 'created' : 'updated'}.`)
		} catch (err) {
			fail(store, err)
		}
	})

	store.on('security/users/delete', async (state, { username }) => {
		const refusal = refuseUserDelete(username, state.securityIdentity)
		if (refusal) {
			store.dispatch('notification/add', { type: 'error', message: refusal })
			return
		}

		try {
			const api = new API(state.connection, state.app?.windowId)
			await api.deleteSecurityUser(username)
			done(store, `User "${username}" deleted.`)
		} catch (err) {
			fail(store, err)
		}
	})

	store.on('security/users/setEnabled', async (state, { username, enabled }) => {
		try {
			const api = new API(state.connection, state.app?.windowId)
			await api.setSecurityUserEnabled(username, enabled)
			done(store, `User "${username}" ${enabled ? 'enabled' : 'disabled'}.`)
		} catch (err) {
			fail(store, err)
		}
	})

	store.on('security/users/password', async (state, { username, password }) => {
		try {
			const api = new API(state.connection, state.app?.windowId)
			await api.changeSecurityUserPassword(username, password)
			store.dispatch('notification/add', {
				type: 'success',
				message: `Password changed for "${username}".`,
			})
		} catch (err) {
			fail(store, err)
		}
	})
}
