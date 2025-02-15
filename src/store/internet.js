export const internet = store => {
	store.on('@init', () => ({
		internet: {
			online: false,
		},
	}))

	store.on('internet/online', () => ({
		internet: {
			online: true,
		},
	}))

	store.on('internet/offline', () => ({
		internet: {
			online: false,
		},
	}))
}
