import API from '../api/elasticsearch'
import get from 'lodash/get'

import { trackEvent } from '../utils/analitycs'

export const server = store => {
  store.on('@init', () => {
    return {
      server: {
        version: null,
      },
    }
  })

  store.on('server/info', async state => {
    try {
      const api = new API(state.connection)
      const { version } = await api.test()

      trackEvent('ElasticSearch', 'Version', version.number || 'Unknown')

      store.dispatch('server/update', {
        version,
      })
    } catch (error) {
      store.dispatch('notification/add', {
        type: 'error',
        message: get(
          error,
          'response.data.error.root_cause[0].reason',
          get(error, 'response.data.error.reason', error.message)
        ),
      })
    }
  })

  store.on('server/update', (state, data) => {
    return {
      server: {
        ...state.server,
        ...data,
      },
    }
  })
}
