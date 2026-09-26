import { classifySecurityError } from '../../security/causes.js'

// Shared shape for the three security surfaces, so a failure on one does not
// touch the others.
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
		},
	})

	return store => {
		store.on('@init', initial)
		store.on('disconnected', initial)

		store.on(`${event}/update`, (state, data) => ({
			[key]: { ...state[key], ...data },
		}))

		store.on(`${event}/fetch`, async state => {
			store.dispatch(`${event}/update`, { loading: true })
			try {
				const { entries, scope } = await load(state, store)
				store.dispatch(`${event}/update`, {
					entries,
					scope: scope ?? null,
					loaded: true,
					loading: false,
					cause: null,
					message: null,
					reason: null,
				})
			} catch (err) {
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
	}
}

export const toUserEntries = payload =>
	Object.entries(payload || {}).map(([username, user]) => ({
		...user,
		username,
		reserved: Boolean(user?.metadata?._reserved),
	}))

export const toRoleEntries = payload =>
	Object.entries(payload || {}).map(([name, role]) => ({
		...role,
		name,
		reserved: Boolean(role?.metadata?._reserved),
		hasDocumentQuery: (role?.indices || []).some(i => i?.query),
		hasFieldSecurity: (role?.indices || []).some(i => i?.field_security),
	}))

export const toApiKeyEntries = payload =>
	(payload?.api_keys || []).map(key => ({ ...key }))
