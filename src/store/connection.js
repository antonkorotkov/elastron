import ls from 'local-storage'

import API from '../api/elasticsearch'

export const connection = store => {
  store.on('@init', () => {
    const connections = ls('connection') || []

    if (connections.length)
      return { connection: connections[connections.length - 1] }

    return {
      connection: {
        host: 'http://localhost',
        port: '9200',
        useAuth: false,
        user: '',
        password: '',
      },
    }
  })

  store.on('connection/clear', _state => {
    return {
      connection: {
        host: '',
        port: '',
        useAuth: false,
        user: '',
        password: '',
      },
    }
  })

  store.on('connection/save', async (state, callback = () => {}) => {
    try {
      const api = new API(state.connection)
      const test = await api.test()
      if (test.success) {
        store.dispatch('connected')
        store.dispatch('history/connection/add', state.connection)
      } else {
        store.dispatch('disconnected')
      }
    } catch (error) {
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
