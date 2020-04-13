import API from '../../api/elasticsearch'

export const indices = store => {
  store.on('@init', () => (
    { 
      indices: {
        columns: [],
        data: []
      }
    }
  ))

  store.on('connected', () => {
    store.dispatch('elasticsearch/indices/fetch')
  })

  store.on('disconnected', () => {
    store.dispatch('elasticsearch/indices/update', {
      columns: [], data: []
    })
  })
  
  store.on('elasticsearch/indices/fetch', async (state) => {
    try {
      const api = new API(state.connection)
      const indices = await api.getIndices()
      if (indices) {
        const { columns, data } = indices
        store.dispatch('elasticsearch/indices/update', {
          columns, data
        })
      } else {
        store.dispatch('notification/add', {
          type: 'error', message: 'Could not get indices data'
        })
      }
    } catch (error) {
      store.dispatch('notification/add', {
        type: 'error', message: error.message
      })
    }
  })

  store.on('elasticsearch/indices/update', (_state, indices) => ({indices}))
}