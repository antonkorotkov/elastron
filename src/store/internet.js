export const internet = store => {
  store.on('@init', () => ({
    online: false,
  }))

  store.on('internet/online', _state => ({
    online: true,
  }))

  store.on('internet/offline', _state => ({
    online: false,
  }))
}
