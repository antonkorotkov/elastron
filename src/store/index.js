import { createStoreon } from 'storeon'
import { storeonDevtools } from 'storeon/devtools'

import { connection } from './connection'

export const store = createStoreon([connection, storeonDevtools])