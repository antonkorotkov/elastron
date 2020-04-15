export const search = store => {
  store.on('@init', () => (
    { 
      search: {
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

  store.on('search/run', state => {

  })
}