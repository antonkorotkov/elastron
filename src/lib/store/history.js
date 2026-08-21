import some from 'lodash/some'
import isEqual from 'lodash/isEqual'
import { setStorage } from '../utils/storage'
import { initialSshConfig } from './connection'

const normalizeConnection = connection => {
    const normalized = {
        name: '',
        host: '',
        port: '',
        useAuth: false,
        user: '',
        password: '',
        addHeaders: false,
        headers: [],
        useSshTunnel: false,
        ssh: { ...initialSshConfig },
        color: '',
        ...connection,
    }
    delete normalized.version
    return normalized
}

export const history = store => {
    store.on('@init', () => ({
        history: {
            connection: [], // Will be hydrated
        },
    }))

    store.on('history/hydrate', (state, data) => {
        return {
            history: {
                ...state.history,
                connection: (data.connection || []).map(normalizeConnection),
            }
        }
    })

    store.on('history/connection/clear', state => {
        setStorage('connection', [])

        return {
            history: {
                ...state.history,
                connection: [],
            },
        }
    })

    store.on('history/connection/add', (state, rawConnection) => {
        const connection = normalizeConnection(rawConnection)

        if (some(state.history.connection, item => isEqual(item, connection)))
            return state

        const savedConnections = [...state.history.connection]
        if (savedConnections.length >= 10) {
            savedConnections.shift()
        }
        savedConnections.push(connection)
        setStorage('connection', savedConnections)

        return {
            history: {
                ...state.history,
                connection: savedConnections,
            },
        }
    })

    store.on('history/connection/replace', (state, { index, connection: rawConnection }) => {
        if (index < 0 || index >= state.history.connection.length) return state

        const savedConnections = [...state.history.connection]
        savedConnections[index] = normalizeConnection(rawConnection)
        setStorage('connection', savedConnections)

        return {
            history: {
                ...state.history,
                connection: savedConnections,
            },
        }
    })

    store.on('history/connection/delete', (state, rawConnection) => {
        const connection = normalizeConnection(rawConnection)

        // Remove a single entry rather than every match. Identity here is deep
        // equality, and replacing in place can leave two entries identical, so
        // filtering would silently delete a connection the user did not pick.
        const index = state.history.connection.findIndex(item =>
            isEqual(item, connection)
        )

        if (index === -1) return state

        const savedConnections = [...state.history.connection]
        savedConnections.splice(index, 1)
        setStorage('connection', savedConnections)

        return {
            history: {
                ...state.history,
                connection: savedConnections,
            },
        }
    })
}
