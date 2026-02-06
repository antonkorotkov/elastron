import API from '../api/elasticsearch'
import { getMessageFromError } from '../utils/helpers'

export const server = store => {
	store.on('@init', () => {
		return {
			server: {
				version: null,
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
			},
		}
	})
}
