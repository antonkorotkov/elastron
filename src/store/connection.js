import API from '../api/elasticsearch'

export const connection = store => {
  store.on('@init', () => (
    { 
      connection: {
        host: 'https://search-udx-io-zosdec3doe2ojdyfvckcrvjbtm.us-east-1.es.amazonaws.com', port: 1
      }
    }
  ))

  store.on('connection/save', async (_state, { host, port }) => {
    store.dispatch('connection/update', { host, port })
    try {
      const api = new API(`${host}:${port}`)
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

  store.on('connection/update', (_state, { host, port }) => {
    return {
      connection: {
        host, port
      }
    }
  })
}