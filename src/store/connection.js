import API from '../api/elasticsearch'

export const connection = store => {
  store.on('@init', () => (
    { 
      connection: {
        host: 'https://search-udx-io-zosdec3doe2ojdyfvckcrvjbtm.us-east-1.es.amazonaws.com', 
        port: '',
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