export const connection = store => {
  store.on('@init', () => (
    { 
      connection: {
        host: 'http://localhost', port: 9201
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