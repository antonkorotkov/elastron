import API from '../../api/elasticsearch'
import { createSecurityList, toRoleEntries } from './securityList.js'

const list = createSecurityList({
	key: 'securityRoles',
	event: 'security/roles',
	load: async state => {
		const api = new API(state.connection, state.app?.windowId)
		return { entries: toRoleEntries(await api.getSecurityRoles()) }
	},
})

export const securityRoles = store => {
	list(store)

	store.on('@init', () => ({
		// Privilege names come from the connected cluster, never from a list
		// compiled into the app: 9.x offers `monitor_esql` and 8.x does not.
		securityPrivileges: { cluster: [], index: [], remote_cluster: [], loaded: false },
	}))

	store.on('disconnected', () => ({
		securityPrivileges: { cluster: [], index: [], remote_cluster: [], loaded: false },
	}))

	store.on('security/privileges/fetch', async state => {
		try {
			const api = new API(state.connection, state.app?.windowId)
			const privileges = await api.getBuiltinPrivileges()
			store.dispatch('security/privileges/set', {
				cluster: privileges?.cluster || [],
				index: privileges?.index || [],
				remote_cluster: privileges?.remote_cluster || [],
				loaded: true,
			})
		} catch {
			// The editor falls back to free text when the cluster will not say.
			store.dispatch('security/privileges/set', { loaded: true })
		}
	})

	store.on('security/privileges/set', (state, data) => ({
		securityPrivileges: { ...state.securityPrivileges, ...data },
	}))

	store.on('security/roles/put', async (state, { name, body, isNew }) => {
		try {
			const api = new API(state.connection, state.app?.windowId)
			await api.putSecurityRole(name, body)
			store.dispatch('notification/add', {
				type: 'success',
				message: `Role "${name}" ${isNew ? 'created' : 'updated'}.`,
			})
			store.dispatch('security/roles/fetch')
		} catch (err) {
			store.dispatch('notification/add', {
				type: 'error',
				message: err?.message || 'The role could not be saved.',
			})
		}
	})

	store.on('security/roles/delete', async (state, { name }) => {
		try {
			const api = new API(state.connection, state.app?.windowId)
			await api.deleteSecurityRole(name)
			store.dispatch('notification/add', { type: 'success', message: `Role "${name}" deleted.` })
			store.dispatch('security/roles/fetch')
		} catch (err) {
			store.dispatch('notification/add', {
				type: 'error',
				message: err?.message || 'The role could not be deleted.',
			})
		}
	})
}
