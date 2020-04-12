import { createRouter } from '@storeon/router'

export const routes = createRouter([
  ['/', () => ({page: 'dashboard'})],
  ['/mapping', () => ({page: 'mapping'})],
  ['/search', () => ({page: 'search'})]
])