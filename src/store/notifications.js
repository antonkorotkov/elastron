function randomId() {
  return Math.random().toString();
}

export const notifications = store => {
  store.on('@init', () => (
    { 
      notifications: []
    }
  ))

  store.on('connected', () => {
    store.dispatch('notification/add', {
      type: 'success', message: 'Connected to the server'
    })
  })

  store.on('disconnected', () => {
    store.dispatch('notification/add', {
      type: 'error', message: 'Disconnected from the server'
    })
  })

  store.on('notification/add', (state, { type, message }) => {
    if (state.notifications.find(n => {
      return n.type === type && n.message === message
    })) {
      return {
        notifications: [...state.notifications]
      }
    }

    return {
      notifications: [...state.notifications, { id: randomId(), type, message }]
    }
  })

  store.on('notification/delete', (state, id) => (
    {
      notifications: state.notifications.filter(notification => notification.id !== id)
    }
  ))

  store.on('notification/shift', (state) => {
    const notifications = [...state.notifications]
    notifications.shift()
    return {
      notifications
    }
  })
}