import ipcRenderer from '../api/ipc-renderer'
import get from 'lodash/get'

export const importExport = store => {
  store.on('@init', () => ({
    importExport: {
      input: {
        type: 'file',
        file: '',
        index: null,
        connection: null,
        remoteIndices: [],
        address: '',
      },
      output: {
        type: 'index',
        file: '',
        index: null,
        connection: null,
        remoteIndices: [],
        address: '',
      },
      options: [
        {
          name: 'limit',
          value: '100',
        },
      ],
      isRunning: false,
    },
  }))

  store.on('@changed', (__, payload, store) => {
    if (
      get(payload, 'history.connection', false) ||
      get(payload, 'connection', false)
    ) {
      store.dispatch('ie/input/reset', null)
      store.dispatch('ie/output/reset', null)
    }
  })

  store.on('ie/input/reset', state => ({
    importExport: {
      ...state.importExport,
      input: {
        ...state.importExport.input,
        file: '',
        index: null,
        connection: null,
        remoteIndices: [],
        address: '',
      },
    },
  }))

  store.on('ie/output/reset', state => ({
    importExport: {
      ...state.importExport,
      output: {
        ...state.importExport.output,
        file: '',
        index: null,
        connection: null,
        remoteIndices: [],
        address: '',
      },
    },
  }))

  store.on('ie/input/address', (state, address) => ({
    importExport: {
      ...state.importExport,
      input: {
        ...state.importExport.input,
        address,
      },
    },
  }))

  store.on('ie/output/address', (state, address) => ({
    importExport: {
      ...state.importExport,
      output: {
        ...state.importExport.output,
        address,
      },
    },
  }))

  store.on('ie/input/remoteIndices', (state, remoteIndices) => ({
    importExport: {
      ...state.importExport,
      input: {
        ...state.importExport.input,
        remoteIndices,
      },
    },
  }))

  store.on('ie/output/remoteIndices', (state, remoteIndices) => ({
    importExport: {
      ...state.importExport,
      output: {
        ...state.importExport.output,
        remoteIndices,
      },
    },
  }))

  store.on('ie/input/connection', (state, connection) => ({
    importExport: {
      ...state.importExport,
      input: {
        ...state.importExport.input,
        connection,
      },
    },
  }))

  store.on('ie/output/connection', (state, connection) => ({
    importExport: {
      ...state.importExport,
      output: {
        ...state.importExport.output,
        connection,
      },
    },
  }))

  store.on('ie/delete/option', (state, index) => {
    let options = [...state.importExport.options]
    options.splice(index, 1)

    return {
      importExport: {
        ...state.importExport,
        options,
      },
    }
  })

  store.on('ie/update/option', (state, { index, field, value }) => {
    let options = [...state.importExport.options]
    options[index][field] = value

    return {
      importExport: {
        ...state.importExport,
        options,
      },
    }
  })

  store.on('ie/add/option', state => {
    let options = [...state.importExport.options]
    options.push({
      name: '',
      value: '',
    })

    return {
      importExport: {
        ...state.importExport,
        options,
      },
    }
  })

  store.on('ie/input/type', (state, type) => ({
    importExport: {
      ...state.importExport,
      input: {
        ...state.importExport.input,
        type,
      },
    },
  }))

  store.on('ie/input/file', (state, file) => ({
    importExport: {
      ...state.importExport,
      input: {
        ...state.importExport.input,
        file,
      },
    },
  }))

  store.on('ie/input/index', (state, index) => ({
    importExport: {
      ...state.importExport,
      input: {
        ...state.importExport.input,
        index,
      },
    },
  }))

  store.on('ie/output/type', (state, type) => ({
    importExport: {
      ...state.importExport,
      output: {
        ...state.importExport.output,
        type,
      },
    },
  }))

  store.on('ie/output/file', (state, file) => ({
    importExport: {
      ...state.importExport,
      output: {
        ...state.importExport.output,
        file,
      },
    },
  }))

  store.on('ie/output/index', (state, index) => ({
    importExport: {
      ...state.importExport,
      output: {
        ...state.importExport.output,
        index,
      },
    },
  }))

  store.on('ie/run', (state, options) => {
    ipcRenderer.run('import-export-run', options).then(result => {
      store.dispatch('ie/finish')
    })

    return {
      importExport: {
        ...state.importExport,
        isRunning: true,
      },
    }
  })

  store.on('ie/finish', state => {
    return {
      importExport: {
        ...state.importExport,
        isRunning: false,
      },
    }
  })
}
