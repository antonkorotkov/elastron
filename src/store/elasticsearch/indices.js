import API from '../../api/elasticsearch'

import { trackEvent } from '../../utils/analitycs'

export const indices = store => {
  store.on('@init', () => ({
    indices: {
      columns: [],
      data: [],
      loading: false,
    },
  }))

  store.on('connected', () => {
    store.dispatch('elasticsearch/indices/fetch')
  })

  store.on('disconnected', () => {
    store.dispatch('elasticsearch/indices/update', {
      columns: [],
      data: [],
      loading: false,
    })
  })

  store.on('elasticsearch/indices/fetch', async (state, cb) => {
    try {
      store.dispatch('elasticsearch/indices/update', {
        loading: true,
      })
      const api = new API(state.connection)
      const indices = await api.getIndices()
      if (indices) {
        const { columns, data } = indices
        store.dispatch('elasticsearch/indices/update', {
          columns,
          data,
          loading: false,
        })
        if (typeof cb === 'function') {
          cb()
        }
      } else {
        store.dispatch('notification/add', {
          type: 'error',
          message: 'Could not get indices data',
        })
        store.dispatch('elasticsearch/indices/update', {
          loading: false,
        })
      }
    } catch (error) {
      store.dispatch('notification/add', {
        type: 'error',
        message: error.message,
      })
      store.dispatch('elasticsearch/indices/update', {
        loading: false,
      })
      trackEvent('Error', 'Indices', error.message)
    }
  })

  store.on('elasticsearch/indices/update', (state, indices) => ({
    indices: { ...state.indices, ...indices },
  }))
}
