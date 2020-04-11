export const connection = store => {
  store.on('@init', () => (
    { 
      connection: {
        host: 'https://search-udx-io-zosdec3doe2ojdyfvckcrvjbtm.us-east-1.es.amazonaws.com', port: 1
      }
    }
  ))

  store.on('connection/update', (_state, { host, port }) => (
    {
      connection: {
        host, port
      }
    }
  ))
}