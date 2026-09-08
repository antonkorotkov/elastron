import { createStoreon } from 'storeon'
import { storeonDevtools } from 'storeon/devtools'

import { app } from './app'
import { server } from './server'
import { internet } from './internet'
import { connection } from './connection'
import { notifications } from './notifications'
import { search } from './search'
import { indices } from './elasticsearch/indices'
import { allocation } from './elasticsearch/allocation'
import { shards } from './elasticsearch/shards'
import { connections } from './connections'
import { index } from './elasticsearch/index'
import { mappings } from './elasticsearch/mappings'
import { monitoring } from './elasticsearch/monitoring'
import { playground } from './playground'
import { updater } from './updater'


export const store = createStoreon([
	app,
	server,
	internet,
	connections,
	connection,
	notifications,
	search,
	indices,
	allocation,
	shards,
	index,
	mappings,
	monitoring,
	playground,
	updater,
	storeonDevtools
])


