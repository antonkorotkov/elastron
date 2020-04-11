import { createRouter } from '@storeon/router'

export const routes = createRouter([
  ['/', () => ({page: 'dashboard'})],
  ['/health', () => ({page: 'health'})]
])