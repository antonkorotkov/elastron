import ls from 'local-storage'

import API from '../api/elasticsearch'
import { trackEvent } from '../utils/analitycs'

const initial = {
  name: 'Local Server',
  host: 'http://localhost',
  port: '9200',
  useAuth: false,
  user: '',
  password: '',
  addHeaders: false,
  headers: [{ name: '', value: '' }],
}

export const connection = store => {
  store.on('@init', () => {
    const connections = ls('connection') || []

    if (connections.length)
      return { connection: {...initial, ...connections[connections.length - 1]} }

    return {
      connection: initial,
    }
  })

  store.on('connection/clear', _state => {
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

  store.on('connection/save', async (state, callback = () => {}) => {
    try {
      const api = new API(state.connection)
      const test = await api.test()
      if (test.success) {
        store.dispatch('connected')
        store.dispatch('history/connection/add', state.connection)
        store.dispatch('server/update', {
          version: test.version,
        })
        trackEvent('ElasticSearch', 'Version', test.version.number || 'Unknown')
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
