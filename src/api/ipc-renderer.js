const { ipcRenderer } = require('electron')

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
