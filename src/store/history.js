import ls from 'local-storage'
import some from 'lodash/some'
import isEqual from 'lodash/isEqual'

export const history = store => {
  store.on('@init', () => (
    { 
      history: {
        connection: ls('connection') || []
      }
    }
  ))

  store.on('history/connection/clear', state => {
    ls('connection', [])
    return {
      history: {
        ...state.history,
        connection: []
      }
    }
  })

  store.on('history/connection/add', (state, connection) => {
    if (some(state.history.connection, item => isEqual(item, connection))) 
      return state

    const savedConnections = ls('connection') || []
    if (savedConnections.length >= 10) {
      savedConnections.shift()
    }
    savedConnections.push(connection)
    ls('connection', savedConnections)

    return {
      history: {
        ...state.history,
        connection: [...savedConnections]
      }
    }
  })
}