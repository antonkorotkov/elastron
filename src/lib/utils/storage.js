export const getStorage = async (key, defaultValue) => {
    if (typeof window !== 'undefined' && window.electron?.ipcRenderer?.store) {
        return await window.electron.ipcRenderer.store.get(key, defaultValue);
    }
    return defaultValue;
};

export const setStorage = (key, value) => {
    if (typeof window !== 'undefined' && window.electron?.ipcRenderer?.store) {
        window.electron.ipcRenderer.store.set(key, value);
    }
};
