import ls from 'local-storage'

import { trackEvent } from '../utils/analitycs'

export const app = store => {
  store.on('@init', () => {
    const theme = ls('theme') || 'light'

    trackEvent('App', 'Theme', theme)

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
