import API from '../../api/elasticsearch'

import { trackEvent } from '../../utils/analitycs'

export const allocation = store => {
  store.on('@init', () => ({
    allocation: {
      columns: [],
      data: [],
      loading: false,
    },
  }))

  store.on('connected', () => {
    store.dispatch('elasticsearch/allocation/fetch')
  })

  store.on('disconnected', () => {
    store.dispatch('elasticsearch/allocation/update', {
      columns: [],
      data: [],
      loading: false,
    })
  })

  store.on('elasticsearch/allocation/fetch', async state => {
    try {
      store.dispatch('elasticsearch/allocation/update', {
        loading: true,
      })
      const api = new API(state.connection)
      const allocation = await api.getAllocation()
      if (allocation) {
        const { columns, data } = allocation
        store.dispatch('elasticsearch/allocation/update', {
          columns,
          data,
          loading: false,
        })
      } else {
        store.dispatch('notification/add', {
          type: 'error',
          message: 'Could not get allocation data',
        })
        store.dispatch('elasticsearch/allocation/update', {
          loading: false,
        })
      }
    } catch (error) {
      store.dispatch('notification/add', {
        type: 'error',
        message: error.message,
      })
      store.dispatch('elasticsearch/allocation/update', {
        loading: false,
      })
      trackEvent('Error', 'Allocation', error.message)
    }
  })

  store.on('elasticsearch/allocation/update', (state, allocation) => ({
    allocation: { ...state.allocation, ...allocation },
  }))
}
