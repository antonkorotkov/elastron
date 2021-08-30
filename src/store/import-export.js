export const importExport = store => {
  store.on('@init', () => ({
    importExport: {
      input: {
        type: 'file',
        source: '',
      },
      output: {
        type: 'index',
        destination: '',
      },
    },
  }))

  store.on('ie/input/type', (state, type) => ({
    importExport: {
      ...state.importExport,
      input: {
        ...state.importExport.input,
        type,
      },
    },
  }))

  store.on('ie/input/source', (state, source) => ({
    importExport: {
      ...state.importExport,
      input: {
        ...state.importExport.input,
        source,
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

  store.on('ie/output/destination', (state, destination) => ({
    importExport: {
      ...state.importExport,
      output: {
        ...state.importExport.output,
        destination,
      },
    },
  }))
}
