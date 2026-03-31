import API from '../api/elasticsearch'
import { setStorage } from '../utils/storage'

export const initialConnection = {
	name: 'Local Server',
	host: 'https://localhost',
	port: '9200',
	useAuth: false,
	user: '',
	password: '',
	addHeaders: false,
	headers: [{ name: '', value: '' }],
}

export const connection = store => {
	store.on('@init', () => {
		return {
			connection: initialConnection,
		}
	})

	store.on('connection/hydrate', (state, data) => {
		return {
			connection: {
				...state.connection,
				...data
			}
		}
	})

	store.on('connection/clear', () => {
		return {
			connection: {
				name: '',
				host: '',
				port: '',
				useAuth: false,
				user: '',
				password: '',
				addHeaders: false,
				headers: [{ name: '', value: '' }],
			},
		}
	})

	store.on('connection/save', async (state, callback = () => { }) => {
		try {
			const api = new API(state.connection)
			const test = await api.test()
			if (test.success) {
				store.dispatch('connected')

				const updatedConnection = {
					...state.connection,
					version: test.version.number || test.version
				};

				store.dispatch('history/connection/add', updatedConnection)
				store.dispatch('server/update', {
					version: test.version.number || test.version,
				})
				store.dispatch('connection/update', {
					version: test.version.number || test.version
				})
				setStorage('lastConnection', updatedConnection);
			} else {
				store.dispatch('disconnected')
			}
		} catch {
			store.dispatch('disconnected')
		}
		callback()
	})

	store.on('connection/update', (state, data) => {
		return {
			connection: {
				...state.connection,
				...data,
			},
		}
	})
}
