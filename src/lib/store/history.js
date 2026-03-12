import some from 'lodash/some'
import isEqual from 'lodash/isEqual'
import { setStorage } from '../utils/storage'

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
                ...data
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

    store.on('history/connection/add', (state, connection) => {
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
                connection: [...savedConnections],
            },
        }
    })

    store.on('history/connection/delete', (state, connection) => {
        connection.name = connection.name || ''
        if (!some(state.history.connection, item => isEqual(item, connection)))
            return state

        let savedConnections = [...state.history.connection]
        savedConnections = savedConnections.filter(c => {
            c.name = c.name || ''
            return !isEqual(c, connection)
        })
        setStorage('connection', savedConnections)

        return {
            history: {
                ...state.history,
                connection: [...savedConnections],
            },
        }
    })
}
