export const internet = store => {
  store.on('@init', () => ({
    internet: {
      online: false,
    },
  }))

  store.on('internet/online', _state => ({
    internet: {
      online: true,
    },
  }))

  store.on('internet/offline', _state => ({
    internet: {
      online: false,
    },
  }))
}
