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
import { history } from './history'
import { index } from './elasticsearch/index'
import { monitoring } from './elasticsearch/monitoring'
import { playground } from './playground'


export const store = createStoreon([
	app,
	server,
	internet,
	history,
	connection,
	notifications,
	search,
	indices,
	allocation,
	shards,
	index,
	monitoring,
	playground,
	storeonDevtools
])


