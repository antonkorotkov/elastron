import API from '../../api/elasticsearch'

export const shards = store => {
  store.on('@init', () => ({
    shards: {
      columns: [],
      data: [],
    },
  }))

  store.on('connected', () => {
    store.dispatch('elasticsearch/shards/fetch')
  })

  store.on('disconnected', () => {
    store.dispatch('elasticsearch/shards/update', {
      columns: [],
      data: [],
    })
  })

  store.on('elasticsearch/shards/fetch', async state => {
    try {
      const api = new API(state.connection)
      const shards = await api.getShards()
      if (shards) {
        const { columns, data } = shards
        store.dispatch('elasticsearch/shards/update', {
          columns,
          data,
        })
      } else {
        store.dispatch('notification/add', {
          type: 'error',
          message: 'Could not get shards data',
        })
      }
    } catch (error) {
      store.dispatch('notification/add', {
        type: 'error',
        message: error.message,
      })
    }
  })

  store.on('elasticsearch/shards/update', (_state, { columns, data }) => ({
    shards: {
      columns,
      data,
    },
  }))
}
