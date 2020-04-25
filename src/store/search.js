import API from '../api/elasticsearch'
import get from 'lodash/get'

export const search = store => {
  store.on('@init', () => ({
    search: {
      loading: false,
      type: 'uri',
      index: '_all',
      useDocType: false,
      docType: '_doc',
      useSource: false,
      _source: '',
      requestBody: {
        query: {
          bool: {
            must: {
              match_all: {},
            },
          },
        },
        size: 10,
        from: 0,
        _source: true,
      },
      uriQuery: 'user:kimchy',
      sort: '',
      size: 10,
      from: 0,
      results: [],
      stats: {
        total_results: 0,
        time: 0,
        total_shards: 0,
        successful_shards: 0,
        skipped_shards: 0,
        failed_shards: 0,
      },
    },
  }))

  store.on('connected', () => {
    store.dispatch('elasticsearch/indices/fetch')
  })

  store.on('search/update', (state, data) => {
    return {
      search: {
        ...state.search,
        ...data,
      },
    }
  })

  store.on('search/loading', (state, loading) => ({
    search: {
      ...state.search,
      loading: !!loading,
    },
  }))

  store.on('search/run', async state => {
    try {
      store.dispatch('search/loading', true)

      const buildSearchParams = () => ({
        index: state.search.index,
        type: state.search.useDocType ? state.search.docType : false,
        query:
          state.search.type === 'uri'
            ? state.search.uriQuery
            : state.search.requestBody,
        size: state.search.size,
        from: state.search.from,
        sort: state.search.sort,
        _source: state.search.useSource ? state.search._source : true,
      })

      const api = new API(state.connection)
      let results

      switch (state.search.type) {
        case 'uri':
          results = await api.uriSearch(buildSearchParams())
          break
        case 'body':
          results = await api.bodySearch(buildSearchParams())
          break
      }

      store.dispatch('search/update', {
        results: get(results, 'hits.hits', []),
      })
      const stats = {
        total_results: get(
          results,
          'hits.total.value',
          get(results, 'hits.total', 0)
        ),
        time: get(results, 'took', 0),
        total_shards: get(results, '_shards.total', 0),
        successful_shards: get(results, '_shards.successful', 0),
        skipped_shards: get(results, '_shards.skipped', 0),
        failed_shards: get(results, '_shards.failed', 0),
      }
      store.dispatch('search/update', { stats })

      store.dispatch('search/loading', false)
    } catch (error) {
      store.dispatch('search/loading', false)
      store.dispatch('notification/add', {
        type: 'error',
        message: get(error, 'response.data.error.reason', error.message),
      })
    }
  })
}
