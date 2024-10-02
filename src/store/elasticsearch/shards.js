import API from '../../api/elasticsearch'

export const shards = store => {
  store.on('@init', () => ({
    shards: {
      columns: [],
      data: [],
      loading: false,
    },
  }))

  store.on('connected', () => {
    store.dispatch('elasticsearch/shards/fetch')
  })

  store.on('disconnected', () => {
    store.dispatch('elasticsearch/shards/update', {
      columns: [],
      data: [],
      loading: false,
      search: '',
    })
  })

  store.on('elasticsearch/shards/fetch', async state => {
    try {
      store.dispatch('elasticsearch/shards/update', {
        loading: true,
      })
      const api = new API(state.connection)
      const shards = await api.getShards()
      if (shards) {
        const { columns, data } = shards
        store.dispatch('elasticsearch/shards/update', {
          columns,
          data,
          loading: false,
        })
      } else {
        store.dispatch('notification/add', {
          type: 'error',
          message: 'Could not get shards data',
        })
        store.dispatch('elasticsearch/shards/update', {
          loading: false,
        })
      }
    } catch (error) {
      store.dispatch('notification/add', {
        type: 'error',
        message: error.message,
      })
      store.dispatch('elasticsearch/shards/update', {
        loading: false,
      })
    }
  })

  store.on('elasticsearch/shards/update', (state, shards) => ({
    shards: { ...state.shards, ...shards },
  }))
}
