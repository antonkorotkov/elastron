import { createStoreon } from 'storeon'
import { storeonDevtools } from 'storeon/devtools'

import { app } from './app'
import { server } from './server'
import { internet } from './internet'
import { connection } from './connection'
import { routes } from './routes'
import { notifications } from './notifications'
import { search } from './search'
import { indices } from './elasticsearch/indices'
import { allocation } from './elasticsearch/allocation'
import { shards } from './elasticsearch/shards'
import { history } from './history'
import { index } from './elasticsearch/index'
import { importExport } from './import-export'

export const store = createStoreon([
  app,
  server,
  internet,
  history,
  connection,
  routes,
  notifications,
  search,
  indices,
  allocation,
  shards,
  index,
  importExport,
  storeonDevtools
])
