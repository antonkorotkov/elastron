export const updater = store => {
	store.on('@init', () => {
		if (typeof window !== 'undefined' && window.electron?.ipcRenderer) {
			window.electron.ipcRenderer.on('update_available', () => {
				store.dispatch('updater/download-start')
			})

			window.electron.ipcRenderer.on('update-download-progress', ({ percent }) => {
				store.dispatch('updater/download-progress', percent)
			})

			window.electron.ipcRenderer.on('update_downloaded', () => {
				store.dispatch('updater/download-complete')
			})
		}

		return {
			updater: {
				downloading: false,
				percent: 0,
				downloaded: false,
			},
		}
	})

	store.on('updater/download-start', state => ({
		updater: {
			...state.updater,
			downloading: true,
			percent: 0,
		},
	}))

	store.on('updater/download-progress', (state, percent) => ({
		updater: {
			...state.updater,
			percent,
		},
	}))

	store.on('updater/download-complete', state => ({
		updater: {
			...state.updater,
			downloading: false,
			downloaded: true,
		},
	}))

	store.on('updater/restart', () => {
		if (typeof window !== 'undefined' && window.electron?.ipcRenderer) {
			window.electron.ipcRenderer.send('restart-and-install')
		}
	})
}
