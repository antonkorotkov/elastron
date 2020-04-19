import API from '../api/elasticsearch'

export const connection = store => {
  store.on('@init', () => (
    { 
      connection: {
        host: 'http://localhost', 
        port: '9200',
        useAuth: false,
        user: '',
        password: '',
      }
    }
  ))

  store.on('connection/save', async (_state, connection) => {
    store.dispatch('connection/update', connection)
    try {
      const api = new API(connection)
      const test = await api.test()
      if (test.success) {
        store.dispatch('connected')
      } else {
        store.dispatch('disconnected')
      }
    } catch (error) {
      store.dispatch('disconnected')
    }
  })

  store.on('connection/update', (_state, connection) => {
    return {
      connection
    }
  })
}