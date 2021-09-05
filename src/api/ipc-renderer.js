let ipcRenderer

if (typeof require === 'function') {
  ipcRenderer = require('electron').ipcRenderer
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
