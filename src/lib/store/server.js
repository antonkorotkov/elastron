import API, { setReachabilityListener } from '../api/elasticsearch'
import { getMessageFromError, getVersionNumber } from '../utils/helpers'

export const server = store => {
	store.on('@init', () => {
		setReachabilityListener(reachable =>
			store.dispatch('server/reachability', reachable)
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

	// Fed by every renderer request. Returning nothing when the value is
	// unchanged keeps subscribers from re-rendering on each request.
	store.on('server/reachability', (state, reachable) => {
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
