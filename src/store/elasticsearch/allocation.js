export const allocation = store => {
  store.on('@init', () => (
    { 
      allocation: {
        columns: [],
        data: []
      }
    }
  ))

  store.on('elasticsearch/allocation/update', (_state, { columns, data }) => (
    {
      allocation: {
        columns, data
      }
    }
  ))
}