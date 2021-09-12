let ipcRenderer = {
  on: () => {},
  once: () => {},
  send: () => {},
  run: () => {},
}

if (typeof require === 'function') {
  ipcRenderer = require('electron').ipcRenderer
}

export default {
  listen: (eventName, callbackFunction) => {
    ipcRenderer.on(eventName, callbackFunction)
  },

  once: (eventName, callbackFunction) => {
    ipcRenderer.once(eventName, callbackFunction)
  },

  send: (eventName, ...messageData) => {
    ipcRenderer.send(eventName, ...messageData)
  },

  run: (eventName, ...messageData) => {
    return ipcRenderer.invoke(eventName, ...messageData)
  },
}
