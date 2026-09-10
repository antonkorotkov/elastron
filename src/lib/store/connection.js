import API, { openTunnel, closeTunnel } from '../api/elasticsearch'
import { setStorage } from '../utils/storage'
import { getVersionNumber } from '../utils/helpers'

export const initialSshConfig = {
	host: '',
	port: '22',
	username: '',
	authMethod: 'password',
	password: '',
	privateKeyContent: '',
	privateKeyName: '',
	passphrase: '',
}

export const initialConnection = {
	name: 'Local Server',
	host: 'https://localhost',
	port: '9200',
	useAuth: false,
	user: '',
	password: '',
	addHeaders: false,
	headers: [{ name: '', value: '' }],
	useSshTunnel: false,
	ssh: { ...initialSshConfig },
	color: '',
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
				useSshTunnel: false,
				ssh: { ...initialSshConfig },
				color: '',
			},
		}
	})

	store.on('connection/save', async (state, callback = () => { }) => {
		try {
			const windowId = state.app?.windowId

			// Explicitly clean up any existing tunnel from a prior connection
			if (windowId) {
				await closeTunnel(windowId).catch(() => {})
			}

			// Open SSH tunnel if configured
			if (state.connection.useSshTunnel) {
				const tunnelResult = await openTunnel(state.connection, windowId)
				if (tunnelResult.error) {
					store.dispatch('notification/add', {
						type: 'error',
						message: `SSH Tunnel: ${tunnelResult.error}`,
					})
					store.dispatch('disconnected')
					callback()
					return
				}
			}

			const api = new API(state.connection, windowId)
			const test = await api.test()
			if (test.success) {
				const version = getVersionNumber(test.version)
				const flavor = test.version?.build_flavor

				store.dispatch('connected', { version, flavor })

				const updatedConnection = {
					...state.connection,
					version
				};

				store.dispatch('connections/add', updatedConnection)
				store.dispatch('server/update', { version })
				store.dispatch('connection/update', { version })
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

	store.on('disconnected', (state) => {
		const windowId = state.app?.windowId
		if (state.connection?.useSshTunnel && windowId) {
			closeTunnel(windowId).catch(() => { })
		}
	})
}
