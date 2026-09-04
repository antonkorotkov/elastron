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

export const connections = store => {
    store.on('@init', () => ({
        connections: {
            connection: [], // Will be hydrated
        },
    }))

    store.on('connections/hydrate', (state, data) => {
        return {
            connections: {
                ...state.connections,
                connection: (data.connection || []).map(normalizeConnection),
            }
        }
    })

    store.on('connections/clear', state => {
        setStorage('connection', [])

        return {
            connections: {
                ...state.connections,
                connection: [],
            },
        }
    })

    store.on('connections/add', (state, rawConnection) => {
        const connection = normalizeConnection(rawConnection)

        if (some(state.connections.connection, item => isEqual(item, connection)))
            return state

        const savedConnections = [...state.connections.connection]
        savedConnections.push(connection)
        setStorage('connection', savedConnections)

        return {
            connections: {
                ...state.connections,
                connection: savedConnections,
            },
        }
    })

    store.on('connections/replace', (state, { index, connection: rawConnection }) => {
        if (index < 0 || index >= state.connections.connection.length) return state

        const savedConnections = [...state.connections.connection]
        savedConnections[index] = normalizeConnection(rawConnection)
        setStorage('connection', savedConnections)

        return {
            connections: {
                ...state.connections,
                connection: savedConnections,
            },
        }
    })

    store.on('connections/delete', (state, rawConnection) => {
        const connection = normalizeConnection(rawConnection)

        // Remove a single entry rather than every match. Identity here is deep
        // equality, and replacing in place can leave two entries identical, so
        // filtering would silently delete a connection the user did not pick.
        const index = state.connections.connection.findIndex(item =>
            isEqual(item, connection)
        )

        if (index === -1) return state

        const savedConnections = [...state.connections.connection]
        savedConnections.splice(index, 1)
        setStorage('connection', savedConnections)

        return {
            connections: {
                ...state.connections,
                connection: savedConnections,
            },
        }
    })
}
