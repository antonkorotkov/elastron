import API from '../api/elasticsearch'
import get from 'lodash/get'

export const search = store => {
  store.on('@init', () => (
    { 
      search: {
        loading: false,
        type: 'uri',
        index: '',
        useDocType: false,
        docType: '_doc',
        requestBody: {
          query: ''
        },
        uriQuery: 'user:kimchy',
        size: 10,
        from: 0,
        results: []
      }
    }
  ))

  store.on('connected', () => {
    store.dispatch('elasticsearch/indices/fetch')
  })

  store.on('search/change/type', (state, type) => (
    {
      search: {
        ...state.search,
        type
      }
    }
  ))

  store.on('search/change/index', (state, index) => (
    {
      search: {
        ...state.search,
        index
      }
    }
  ))

  store.on('search/change/useDocType', (state, useDocType) => (
    {
      search: {
        ...state.search,
        useDocType
      }
    }
  ))

  store.on('search/change/docType', (state, docType) => {
    return {
      search: {
        ...state.search,
        docType
      }
    }
  })

  store.on('search/change/request-body', (state, requestBody) => (
    {
      search: {
        ...state.search,
        requestBody
      }
    }
  ))

  store.on('search/change/uri-query', (state, uriQuery) => (
    {
      search: {
        ...state.search,
        uriQuery
      }
    }
  ))

  store.on('search/change/size', (state, size) => {
    size = Number(size) < 0 ? 10 : Number(size)
    return {
      search: {
        ...state.search,
        size
      }
    }
  })

  store.on('search/change/from', (state, from) => {
    from = Number(from) < 0 ? 10 : Number(from)
    return {
      search: {
        ...state.search,
        from
      }
    }
  })

  store.on('search/loading', (state, loading) => (
    {
      search: {
        ...state.search,
        loading: !!loading
      }
    }
  ))

  store.on('search/change/results', (state, results) => (
    {
      search: {
        ...state.search,
        results
      }
    }
  ))

  store.on('search/run', async state => {
    try {
      store.dispatch('search/loading', true)

      const buildSearchParams = () => ({
        index: state.search.index,
        type: state.search.useDocType ? state.search.docType : false,
        query: state.search.type === 'uri' ? state.search.uriQuery : state.search.requestBody,
        size: state.search.size,
        from: state.search.from
      })

      const api = new API(state.connection)
      let results;

      switch(state.search.type) {
        case 'uri':
          results = await api.uriSearch(buildSearchParams())
          break;
        case 'body':
          break;
      }

      store.dispatch('search/change/results', get(results, 'hits.hits', []))

      store.dispatch('search/loading', false)
    } catch (error) {
      store.dispatch('search/loading', false)
      store.dispatch('notification/add', {
        type: 'error', message: error.message
      })
    }
  })
}