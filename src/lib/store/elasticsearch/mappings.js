import API from '../../api/elasticsearch'
import { getMessageFromError } from '../../utils/helpers'

const emptyState = () => ({ info: {}, loading: {}, error: {} })

/**
 * Whether an index selection is worth a `GET /{index}` call. Wildcards and
 * comma-separated lists resolve server-side and are fine; `_all` and a bare `*`
 * would pull the mapping of every index on the cluster.
 *
 * @param {string} index
 * @returns {boolean}
 */
export const isFetchableIndex = index => {
	const trimmed = String(index ?? '').trim()
	return !!trimmed && trimmed !== '_all' && trimmed !== '*'
}

/**
 * Caches index mappings for the search table's field picker and sort gating.
 *
 * Kept separate from the `index` module, which is bound to the Index
 * workspace's `selected` index; the search page picks its index independently
 * and may point at a pattern the Index workspace never opened.
 */
export const mappings = store => {
	// Tracks the newest in-flight request per index so a slow response for a
	// previously selected index cannot overwrite the current one.
	const inFlight = new Map()
	let sequence = 0

	const reset = () => {
		inFlight.clear()
		return { mappings: emptyState() }
	}

	store.on('@init', () => ({ mappings: emptyState() }))

	// Mappings belong to a cluster, so they cannot outlive the connection.
	store.on('connected', reset)
	store.on('disconnected', reset)

	store.on('elasticsearch/mappings/loading', (state, { index, loading }) => ({
		mappings: {
			...state.mappings,
			loading: { ...state.mappings.loading, [index]: !!loading },
		},
	}))

	store.on('elasticsearch/mappings/set', (state, { index, info }) => ({
		mappings: {
			...state.mappings,
			info: { ...state.mappings.info, [index]: info },
			error: { ...state.mappings.error, [index]: null },
		},
	}))

	store.on('elasticsearch/mappings/error', (state, { index, error }) => ({
		mappings: {
			...state.mappings,
			error: { ...state.mappings.error, [index]: error },
		},
	}))

	store.on('elasticsearch/mappings/fetch', async (state, payload) => {
		const index = String(payload?.index ?? '').trim()
		if (!isFetchableIndex(index)) return

		const cached = state.mappings.info[index]
		if (!payload?.force && (cached || state.mappings.loading[index])) return

		const token = ++sequence
		inFlight.set(index, token)
		store.dispatch('elasticsearch/mappings/loading', { index, loading: true })

		try {
			const info = await new API(state.connection).getIndex(index)
			if (inFlight.get(index) !== token) return
			store.dispatch('elasticsearch/mappings/set', { index, info: info || {} })
		} catch (error) {
			if (inFlight.get(index) !== token) return
			const message = getMessageFromError(error)
			store.dispatch('elasticsearch/mappings/error', { index, error: message })
			store.dispatch('notification/add', {
				type: 'error',
				message: `Could not load mapping for '${index}': ${message}`,
			})
		} finally {
			if (inFlight.get(index) === token) {
				inFlight.delete(index)
				store.dispatch('elasticsearch/mappings/loading', {
					index,
					loading: false,
				})
			}
		}
	})
}
