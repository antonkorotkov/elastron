import ls from 'local-storage'

export const app = store => {
    store.on('@init', () => {
        const theme = ls('theme') || 'light'

        return {
            app: {
                theme,
            },
        }
    })

    store.on('app/toggleTheme', (state, theme) => {
        ls('theme', theme)

        return {
            app: {
                ...state.app,
                theme,
            },
        }
    })
}
