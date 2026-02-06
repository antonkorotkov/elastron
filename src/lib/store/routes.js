import { createRouter } from '@storeon/router'

export const routes = store => {
    if (typeof window !== 'undefined') {
        createRouter([
            ['/', () => ({ page: 'dashboard' })],
            ['/index', () => ({ page: 'index' })],
            ['/index/*', index => ({ page: 'index', index })],
            ['/search', () => ({ page: 'search' })],
            ['/import-export', () => ({ page: 'import-export' })]
        ])(store)
    }
}
