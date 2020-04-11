import { createStoreon } from 'storeon'
import { storeonDevtools } from 'storeon/devtools'

import { connection } from './connection'
import { routes } from './routes'
import { notifications } from './notifications'

import { allocation } from './elasticsearch/allocation'
import { shards } from './elasticsearch/shards'

export const store = createStoreon([
  connection,
  routes,
  notifications,
  allocation,
  shards,
  storeonDevtools
])