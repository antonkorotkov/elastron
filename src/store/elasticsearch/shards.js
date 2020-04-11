export const shards = store => {
  store.on('@init', () => (
    { 
      shards: {
        columns: [],
        data: []
      }
    }
  ))

  store.on('elasticsearch/shards/update', (_state, { columns, data }) => (
    {
      shards: {
        columns, data
      }
    }
  ))
}