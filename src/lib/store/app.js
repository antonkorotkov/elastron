import { setStorage } from '../utils/storage'

export const app = store => {
	store.on('@init', () => {
		return {
			app: {
				theme: 'light', // Default, will be hydrated
			},
		}
	})

	store.on('app/hydrate', (state, data) => {
		return {
			app: {
				...state.app,
				...data
			}
		}
	})

	store.on('app/toggleTheme', (state, theme) => {
		setStorage('theme', theme)

		return {
			app: {
				...state.app,
				theme,
			},
		}
	})
}
