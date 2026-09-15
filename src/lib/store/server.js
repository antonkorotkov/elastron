import API, { setReachabilityListener } from '../api/elasticsearch'
import { getMessageFromError, getVersionNumber } from '../utils/helpers'
import { endpointOf } from '../utils/endpoint.js'

export const server = store => {
	store.on('@init', () => {
		setReachabilityListener((reachable, connection) =>
			store.dispatch('server/reachability', { reachable, connection })
		)

		return {
			server: {
				version: null,
				flavor: null,
				// Whether the cluster answered the most recent request. Distinct
				// from `disconnected`, which also tears the connection down.
				reachable: false,
			},
		}
	})

	store.on('connected', (state, { flavor } = {}) => ({
		server: {
			...state.server,
			flavor: flavor ?? null,
			reachable: true,
		},
	}))

	store.on('disconnected', state => ({
		server: {
			...state.server,
			reachable: false,
		},
	}))

	// Fed by every renderer request. Only requests to the window's own cluster
	// count; testing another saved connection must not repaint the icon.
	// Returning nothing when the value is unchanged keeps subscribers from
	// re-rendering on each request.
	store.on('server/reachability', (state, report) => {
		const { reachable, connection } =
			typeof report === 'object' && report !== null ? report : { reachable: report }
		if (connection && endpointOf(connection) !== endpointOf(state.connection)) return
		if (state.server.reachable === Boolean(reachable)) return
		return {
			server: {
				...state.server,
				reachable: Boolean(reachable),
			},
		}
	})

	store.on('server/info', async state => {
		try {
			const api = new API(state.connection)
			const { version } = await api.test()

			store.dispatch('server/update', {
				version,
			})
		} catch (error) {
			store.dispatch('notification/add', {
				type: 'error',
				message: getMessageFromError(error)
			})
		}
	})

	store.on('server/update', (state, data) => {
		return {
			server: {
				...state.server,
				...data,
				...('version' in data
					? { version: getVersionNumber(data.version) }
					: {}),
			},
		}
	})
}
