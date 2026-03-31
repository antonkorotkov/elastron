export const getStorage = async (key, defaultValue) => {
	if (typeof window !== 'undefined' && window.electron?.ipcRenderer?.store) {
		return await window.electron.ipcRenderer.store.get(key, defaultValue);
	}
	return defaultValue;
};

export const setStorage = (key, value) => {
	if (typeof window !== 'undefined' && window.electron?.ipcRenderer?.store) {
		// Unproxy Svelte 5 state to plain JS objects/arrays
		const unproxied = JSON.parse(JSON.stringify(value));
		window.electron.ipcRenderer.store.set(key, unproxied);
	}
};
