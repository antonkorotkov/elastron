import { classifySecurityError } from '../../security/causes.js'

// Shared shape for the three security surfaces, so a failure on one does not
// touch the others. A `load` that returns a `cursor` makes the list paged:
// `${event}/more` then appends the next page.
export const createSecurityList = ({ key, event, load, extra = {} }) => {
	const initial = () => ({
		[key]: {
			...extra,
			entries: [],
			// Distinguishes "nothing yet" from "the cluster has none".
			loaded: false,
			loading: false,
			cause: null,
			message: null,
			reason: null,
			search: '',
			sorting: [],
			scope: null,
			cursor: null,
			loadingMore: false,
		},
	})

	return store => {
		// Bumped by every connection change and every new first-page load, so a
		// reply for a superseded cluster, search, or sort is dropped.
		let generation = 0

		store.on('@init', initial)
		store.on('disconnected', () => {
			generation++
			return initial()
		})

		// Switching clusters dispatches only 'connected', so the old cluster's
		// rows are cleared here and a surface already in use reloads.
		store.on('connected', state => {
			const inUse = state[key]?.loaded || state[key]?.loading
			generation++
			store.dispatch(`${event}/reset`)
			// Deferred: connection/save records the new cluster's version, which
			// picks the client, only after 'connected'.
			if (inUse) queueMicrotask(() => store.dispatch(`${event}/fetch`))
		})

		store.on(`${event}/reset`, initial)

		store.on(`${event}/update`, (state, data) => ({
			[key]: { ...state[key], ...data },
		}))

		store.on(`${event}/fetch`, async state => {
			const started = ++generation
			store.dispatch(`${event}/update`, { loading: true, loadingMore: false })
			try {
				const { entries, scope, ...page } = await load(state, store)
				if (started !== generation) return
				store.dispatch(`${event}/update`, {
					...page,
					entries,
					scope: scope ?? null,
					cursor: page.cursor ?? null,
					loaded: true,
					loading: false,
					cause: null,
					message: null,
					reason: null,
				})
			} catch (err) {
				if (started !== generation) return
				const hadEntries = (state[key]?.entries || []).length > 0

				// Entries are left alone so a failed refresh does not blank the list.
				store.dispatch(`${event}/update`, {
					loaded: true,
					loading: false,
					cause: classifySecurityError(err),
					message: err?.message || 'The request failed.',
					reason: err?.reason ?? null,
				})

				// With rows still on screen the surface cannot explain the cause,
				// so it goes to the notification tray.
				if (hadEntries) {
					store.dispatch('notification/add', {
						type: 'error',
						message: err?.message || 'The list could not be refreshed.',
					})
				}
			}
		})

		store.on(`${event}/more`, async state => {
			const list = state[key]
			if (!list?.cursor || list.loading || list.loadingMore) return

			const started = generation
			store.dispatch(`${event}/update`, { loadingMore: true })
			try {
				const { entries, ...page } = await load(state, store, { after: list.cursor })
				if (started !== generation) return
				store.dispatch(`${event}/update`, {
					...page,
					entries: [...store.get()[key].entries, ...entries],
					cursor: page.cursor ?? null,
					loadingMore: false,
				})
			} catch (err) {
				if (started !== generation) return
				store.dispatch(`${event}/update`, { loadingMore: false })
				store.dispatch('notification/add', {
					type: 'error',
					message: err?.message || 'More entries could not be loaded.',
				})
			}
		})
	}
}

export const toUserEntries = payload =>
	Object.entries(payload || {}).map(([username, user]) => ({
		...user,
		username,
		reserved: Boolean(user?.metadata?._reserved),
	}))

const toRoleEntry = (name, role) => ({
	...role,
	name,
	reserved: Boolean(role?.metadata?._reserved),
	hasDocumentQuery: (role?.indices || []).some(i => i?.query),
	hasFieldSecurity: (role?.indices || []).some(i => i?.field_security),
})

export const toRoleEntries = payload =>
	Array.isArray(payload)
		? payload.map(role => toRoleEntry(role.name, role))
		: Object.entries(payload || {}).map(([name, role]) => toRoleEntry(name, role))

export const toApiKeyEntries = payload =>
	(payload?.api_keys || []).map(key => ({ ...key }))
