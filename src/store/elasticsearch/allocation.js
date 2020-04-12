import API from '../../api/elasticsearch'

export const allocation = store => {
  store.on('@init', () => (
    { 
      allocation: {
        columns: [],
        data: []
      }
    }
  ))

  store.on('connected', () => {
    store.dispatch('elasticsearch/allocation/fetch')
  })

  store.on('disconnected', () => {
    store.dispatch('elasticsearch/allocation/update', {
      columns: [], data: []
    })
  })
  
  store.on('elasticsearch/allocation/fetch', async (state) => {
    try {
      const api = new API(state.connection)
      const allocation = await api.getAllocation()
      if (allocation) {
        const { columns, data } = allocation
        store.dispatch('elasticsearch/allocation/update', {
          columns, data
        })
      } else {
        store.dispatch('notification/add', {
          type: 'error', message: 'Could not get allocation data'
        })
      }
    } catch (error) {
      store.dispatch('notification/add', {
        type: 'error', message: error.message
      })
    }
  })

  store.on('elasticsearch/allocation/update', (_state, { columns, data }) => (
    {
      allocation: {
        columns, data
      }
    }
  ))
}