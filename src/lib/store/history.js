import some from 'lodash/some'
import isEqual from 'lodash/isEqual'
import { setStorage } from '../utils/storage'

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

    store.on('history/connection/delete', (state, rawConnection) => {
        const connection = normalizeConnection(rawConnection)

        if (!some(state.history.connection, item => isEqual(item, connection)))
            return state

        let savedConnections = [...state.history.connection]
        savedConnections = savedConnections.filter(c => {
            return !isEqual(c, connection)
        })
        setStorage('connection', savedConnections)

        return {
            history: {
                ...state.history,
                connection: savedConnections,
            },
        }
    })
}
