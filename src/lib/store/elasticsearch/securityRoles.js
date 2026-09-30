import API from '../../api/elasticsearch'
import { createSecurityList, toRoleEntries } from './securityList.js'

export const roleSortDirection = roles => (roles?.sorting?.[0] === 'desc' ? 'desc' : 'asc')

// A cluster without the role query endpoint answers with the whole list once;
// after that the renderer searches and sorts it, so nothing is refetched.
const list = createSecurityList({
	key: 'securityRoles',
	event: 'security/roles',
	extra: { mode: null, total: null },
	load: async (state, store, { after } = {}) => {
		const roles = state.securityRoles
		const api = new API(state.connection, state.app?.windowId)
		const answer = await api.querySecurityRoles({
			search: roles.search,
			direction: roleSortDirection(roles),
			after: after ?? null,
			full: roles.mode === 'full',
		})
		const entries = toRoleEntries(answer?.roles)
		return answer?.mode === 'full'
			? { entries, mode: 'full', total: entries.length, cursor: null }
			: { entries, mode: 'paged', total: answer?.total ?? entries.length, cursor: answer?.cursor ?? null }
	},
})

export const securityRoles = store => {
	list(store)

	const refetchIfPaged = state => {
		if (state.securityRoles.mode !== 'full') store.dispatch('security/roles/fetch')
	}

	store.on('security/roles/search', (state, search) => {
		store.dispatch('security/roles/update', { search })
		refetchIfPaged(store.get())
	})

	store.on('security/roles/sort', (state, direction) => {
		store.dispatch('security/roles/update', { sorting: [direction, 'role', 0] })
		refetchIfPaged(store.get())
	})

	let session = 0

	// Privilege names come from the connected cluster, never from a list
	// compiled into the app: 9.x offers `monitor_esql` and 8.x does not.
	const noPrivileges = () => ({
		securityPrivileges: { cluster: [], index: [], remote_cluster: [], loaded: false },
	})

	store.on('@init', noPrivileges)

	store.on('disconnected', () => {
		session++
		return noPrivileges()
	})

	store.on('connected', state => {
		const inUse = state.securityPrivileges?.loaded
		session++
		store.dispatch('security/privileges/reset')
		if (inUse) queueMicrotask(() => store.dispatch('security/privileges/fetch'))
	})

	store.on('security/privileges/reset', noPrivileges)

	store.on('security/privileges/fetch', async state => {
		const started = session
		try {
			const api = new API(state.connection, state.app?.windowId)
			const privileges = await api.getBuiltinPrivileges()
			if (started !== session) return
			store.dispatch('security/privileges/set', {
				cluster: privileges?.cluster || [],
				index: privileges?.index || [],
				remote_cluster: privileges?.remote_cluster || [],
				loaded: true,
			})
		} catch {
			if (started !== session) return
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
