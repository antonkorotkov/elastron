const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
    ipcRenderer: {
        send: (channel, data) => {
            // whitelist channels
            let validChannels = ['header-doubleclick', 'check-for-updates'];
            if (validChannels.includes(channel)) {
                ipcRenderer.send(channel, data);
            }
        },
        on: (channel, func) => {
            let validChannels = ['update_available', 'update_downloaded'];
            if (validChannels.includes(channel)) {
                // Deliberately strip event as it includes `sender`
                ipcRenderer.on(channel, (event, ...args) => func(...args));
            }
        },
        store: {
            get: (key, defaultValue) => ipcRenderer.invoke('store:get', key, defaultValue),
            set: (key, value) => ipcRenderer.send('store:set', key, value)
        }
    }
});
