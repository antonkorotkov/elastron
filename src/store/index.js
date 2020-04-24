import { createStoreon } from 'storeon'
import { storeonDevtools } from 'storeon/devtools'

import { connection } from './connection'
import { routes } from './routes'
import { notifications } from './notifications'
import { search } from './search'
import { indices } from './elasticsearch/indices'
import { allocation } from './elasticsearch/allocation'
import { shards } from './elasticsearch/shards'
import { history } from './history'

export const store = createStoreon([
  history,
  connection,
  routes,
  notifications,
  search,
  indices,
  allocation,
  shards,
  storeonDevtools,
])
