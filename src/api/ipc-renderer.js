let ipcRenderer

if (typeof window.require === 'function') {
  ipcRenderer = window.require('electron').ipcRenderer
}

export default {
  listen: (eventName, callbackFunction) => {
    ipcRenderer.on(eventName, callbackFunction)
  },

  send: (eventName, ...messageData) => {
    ipcRenderer.send(eventName, ...messageData)
  },

  run: (eventName, ...messageData) => {
    return ipcRenderer.invoke(eventName, ...messageData)
  },
}
