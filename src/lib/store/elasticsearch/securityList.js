import { classifySecurityError } from '../../security/causes.js'

/**
 * The three security surfaces load the cluster's whole list and filter, sort
 * and render it in the app. This factory is that shared shape, so a failure on
 * one surface records itself without touching the other two.
 *
 * `entries` holds the last list the cluster returned. It is deliberately NOT
 * cleared when a refresh starts: a refresh keeps its rows on screen, and only
 * a first load shows the in-progress state in the table body.
 */
export const createSecurityList = ({ key, event, load, extra = {} }) => {
	const initial = () => ({
		[key]: {
			// Surface-specific state, such as the API keys filter.
			...extra,
			entries: [],
			// `loaded` distinguishes "no entries yet" from "the cluster has none",
			// which is what stops an empty-list message appearing mid-load.
			loaded: false,
			loading: false,
			cause: null,
			message: null,
			search: '',
			sorting: [],
			// Surfaces that fall back to a narrower request say so here.
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
				})
			} catch (err) {
				const hadEntries = (state[key]?.entries || []).length > 0

				store.dispatch(`${event}/update`, {
					// Entries are left alone: a failed refresh should not blank a
					// list that is already on screen.
					loaded: true,
					loading: false,
					cause: classifySecurityError(err),
					message: err?.message || 'The request failed.',
				})

				// With nothing on screen the surface itself explains the cause. With
				// rows still showing, the failure is transient news and goes to the
				// notification tray, the way every other failed action in the app does.
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

/** Turns the cluster's keyed user map into a stable, sortable array. */
export const toUserEntries = payload =>
	Object.entries(payload || {}).map(([username, user]) => ({
		...user,
		username,
		reserved: Boolean(user?.metadata?._reserved),
	}))

/** Turns the cluster's keyed role map into a stable, sortable array. */
export const toRoleEntries = payload =>
	Object.entries(payload || {}).map(([name, role]) => ({
		...role,
		name,
		reserved: Boolean(role?.metadata?._reserved),
		// Surfaced as a badge: on a real cluster role names carry no meaning,
		// and whether a role restricts documents is the useful signal.
		hasDocumentQuery: (role?.indices || []).some(i => i?.query),
		hasFieldSecurity: (role?.indices || []).some(i => i?.field_security),
	}))

export const toApiKeyEntries = payload =>
	(payload?.api_keys || []).map(key => ({ ...key }))
