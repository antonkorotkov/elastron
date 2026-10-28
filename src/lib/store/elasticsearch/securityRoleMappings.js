import API from '../../api/elasticsearch'
import { createSecurityList, toRoleMappingEntries } from './securityList.js'
import { toWritableMapping } from '../../workspace/security/role-mappings/mappingModel.js'
import { evaluateRules, refuseMappingChange, rolesComeFromMappings } from '../../workspace/security/guards.js'

const list = createSecurityList({
	key: 'securityRoleMappings',
	event: 'security/roleMappings',
	extra: { catalogue: {} },
	// The rows warn about a lockout before the user acts, so when mappings decide
	// this account's roles the definitions of the roles they grant come along.
	load: async state => {
		const api = new API(state.connection, state.app?.windowId)
		const entries = toRoleMappingEntries(await api.getSecurityRoleMappings())
		if (!rolesComeFromMappings(state.securityIdentity)) return { entries, catalogue: {} }

		const names = [...new Set([...entries.flatMap(m => m.roles || []), ...(state.securityIdentity.roles || [])])]
		const catalogue = names.length ? await api.getSecurityRolesByName(names).catch(() => ({})) : {}
		return { entries, catalogue: catalogue || {} }
	},
})

const fail = (store, err) =>
	store.dispatch('notification/add', {
		type: 'error',
		message: err?.message || 'The request failed.',
	})

// A mapping change can change the account's roles, which the guard reads.
const done = (store, message) => {
	store.dispatch('notification/add', { type: 'success', message })
	store.dispatch('security/identity/fetch')
	store.dispatch('security/roleMappings/fetch')
}

const fetchMappings = async api => toRoleMappingEntries(await api.getSecurityRoleMappings())

// The guard runs here rather than only in the dialog, so no path can reach the
// cluster without it. It judges the cluster's mappings and the account's roles
// as they are now, falling back to the loaded rows when the mappings cannot be
// read, and fetches the role definitions it needs rather than trusting the
// roles surface.
const judge = async (state, api, name, change, fetched) => {
	if (!rolesComeFromMappings(state.securityIdentity)) return null

	const mappings = fetched || (await fetchMappings(api).catch(() => state.securityRoleMappings?.entries || []))
	const me = await api.whoAmI().catch(() => null)
	const identity = { ...state.securityIdentity, roles: Array.isArray(me?.roles) ? me.roles : [] }

	const before = mappings.find(m => m.name === name)
	if (!before) return null

	const after = change(before)
	const others = mappings.filter(m => m.name !== name)
	const names = [
		...new Set(
			[before, after, ...others.filter(m => evaluateRules(m.rules, identity) === true)].flatMap(
				m => m?.roles || []
			).concat(identity.roles)
		),
	]
	const catalogue = names.length ? await api.getSecurityRolesByName(names).catch(() => ({})) : {}

	return refuseMappingChange(before, after, others, identity, catalogue || {})
}

// A warning the user has not acknowledged stops the change as a refusal does.
const blocked = (store, verdict, acknowledged) => {
	if (!verdict || (verdict.level === 'confirm' && acknowledged)) return false
	store.dispatch('notification/add', { type: 'error', message: verdict.message })
	return true
}

export const securityRoleMappings = store => {
	list(store)

	// After a cluster switch the list can load before the new account is known,
	// without the role definitions the rows are judged by.
	store.on('security/identity/update', (state, data) => {
		const rows = state.securityRoleMappings
		if (data.loading !== false || !(rows.loaded || rows.loading)) return
		if (rolesComeFromMappings(state.securityIdentity)) queueMicrotask(() => store.dispatch('security/roleMappings/fetch'))
	})

	store.on('security/roleMappings/put', async (state, { name, body, isNew, acknowledged }) => {
		try {
			const api = new API(state.connection, state.app?.windowId)
			// The API creates and replaces alike, so a new name must not be taken.
			if (isNew && Object.keys((await api.getSecurityRoleMappings([name])) || {}).length) {
				throw new Error(`A role mapping named "${name}" already exists.`)
			}
			if (!isNew) {
				const verdict = await judge(state, api, name, () => body)
				if (blocked(store, verdict, acknowledged)) return
			}
			await api.putSecurityRoleMapping(name, body)
			done(store, `Role mapping "${name}" ${isNew ? 'created' : 'updated'}.`)
		} catch (err) {
			fail(store, err)
		}
	})

	store.on('security/roleMappings/delete', async (state, { name, acknowledged }) => {
		try {
			const api = new API(state.connection, state.app?.windowId)
			const verdict = await judge(state, api, name, () => null)
			if (blocked(store, verdict, acknowledged)) return
			await api.deleteSecurityRoleMapping(name)
			done(store, `Role mapping "${name}" deleted.`)
		} catch (err) {
			fail(store, err)
		}
	})

	// The mapping API replaces the whole mapping, so the toggle sends the
	// cluster's current definition with only `enabled` changed.
	store.on('security/roleMappings/setEnabled', async (state, { name, enabled, acknowledged }) => {
		try {
			const api = new API(state.connection, state.app?.windowId)
			const mappings = await fetchMappings(api)
			const current = mappings.find(m => m.name === name)
			if (!current) throw new Error(`The role mapping "${name}" does not exist on the cluster.`)

			const verdict = await judge(state, api, name, () => ({ ...current, enabled }), mappings)
			if (blocked(store, verdict, acknowledged)) return

			await api.putSecurityRoleMapping(name, toWritableMapping({ ...current, enabled }))
			done(store, `Role mapping "${name}" ${enabled ? 'enabled' : 'disabled'}.`)
		} catch (err) {
			fail(store, err)
		}
	})
}
