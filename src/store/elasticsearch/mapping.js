export const mapping = store => {
  store.on('@init', () => ({
    mapping: {
      index: false,
    },
  }))
}
