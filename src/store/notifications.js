function randomId() {
  return Math.random().toString();
}

export const notifications = store => {
  store.on('@init', () => (
    { 
      notifications: []
    }
  ))

  store.on('notification/add', (state, { type, message }) => (
    {
      notifications: [...state.notifications, { id: randomId(), type, message }]
    }
  ))

  store.on('notification/delete', (state, id) => (
    {
      notifications: state.notifications.filter(notification => notification.id !== id)
    }
  ))
}