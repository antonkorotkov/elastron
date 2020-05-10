let notifyMainProcess = () => {}

if (typeof window.require === 'function') {
  const { ipcRenderer } = window.require('electron')

  notifyMainProcess = () => {
    ipcRenderer.send('online-status-changed', navigator.onLine)
  }
}

const onOnline = callback => {
  const _online = () => {
    notifyMainProcess()
    if (typeof callback === 'function') {
      callback(navigator.onLine)
    }
  }
  window.removeEventListener('online', _online)
  window.addEventListener('online', _online)
}

const onOffline = callback => {
  const _offline = () => {
    notifyMainProcess()
    if (typeof callback === 'function') {
      callback(navigator.onLine)
    }
  }
  window.removeEventListener('offline', _offline)
  window.addEventListener('offline', _offline)
}

const isOnline = navigator.onLine

export default { onOnline, onOffline, notifyMainProcess, isOnline }
