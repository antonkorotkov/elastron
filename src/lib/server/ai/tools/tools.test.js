import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createAssistantTools, toolApproval, toolDefinitions, APPROVAL_NOTE } from './index.js'
import { RESULT_ROW_LIMIT, RESULT_CHAR_LIMIT } from './limits.js'
import { TOOL_NAMES, TOOL_POLICY, needsConfirmation } from '../../../ai/catalog.js'

const es = vi.hoisted(() => ({ request: null, calls: [] }))

vi.mock('../../elastic.js', async importOriginal => ({
	...(await importOriginal()),
	withElasticClient: vi.fn(async (connection, windowId, fn) => {
		es.calls.push({ connection, windowId })
		return fn({ transport: { request: es.request } })
	}),
}))

const connection = { host: 'http://es.internal', port: '9200', useSshTunnel: true }
let tools

const run = (name, input) => tools[name].execute(input, { toolCallId: 'call-1', messages: [] })
const sent = () => es.request.mock.calls.map(([request]) => request)

beforeEach(() => {
	es.request = vi.fn(async () => ({ acknowledged: true }))
	es.calls = []
	tools = createAssistantTools({ connection, windowId: 'win-9' })
})

describe('tool set', () => {
	it('defines exactly the catalog tools', () => {
		expect(Object.keys(tools).sort()).toEqual([...TOOL_NAMES].sort())
		expect(Object.keys(toolDefinitions).sort()).toEqual([...TOOL_NAMES].sort())
	})

	it('tells the model every write pauses for approval and should be called directly', () => {
		for (const name of TOOL_NAMES) {
			if (needsConfirmation(name)) expect(tools[name].description).toContain(APPROVAL_NOTE)
			else expect(tools[name].description).not.toContain(APPROVAL_NOTE)
		}
	})

	it('points the handoff tool at search results and away from changes', () => {
		expect(tools['propose-query'].description).toContain('after running a search the user wants to see the results of')
		expect(tools['propose-query'].description).toContain('call the matching tool instead')
	})

	it('routes every request through the window connection', async () => {
		await run('cluster-health', {})
		expect(es.calls).toEqual([{ connection, windowId: 'win-9' }])
	})

	it('surfaces the Elasticsearch reason when a request fails', async () => {
		es.request = vi.fn(async () => {
			throw Object.assign(new Error('ResponseError'), {
				meta: { body: { error: { reason: 'no such index [nope]' } } },
			})
		})
		await expect(run('get-mapping', { index: 'nope' })).rejects.toThrow('no such index [nope]')
	})
})

describe('auto read tools', () => {
	const reads = [
		['list-indices', {}, { method: 'GET', path: '/_cat/indices', querystring: { format: 'json', h: 'index,health,status,docs.count,store.size,pri,rep', s: 'index' } }],
		['list-aliases', {}, { method: 'GET', path: '/_cat/aliases', querystring: { format: 'json', s: 'alias' } }],
		['get-index', { index: 'logs' }, { method: 'GET', path: '/logs' }],
		['get-mapping', { index: 'logs' }, { method: 'GET', path: '/logs/_mapping' }],
		['get-index-settings', { index: 'logs' }, { method: 'GET', path: '/logs/_settings' }],
		['get-document', { index: 'logs', id: 'a1' }, { method: 'GET', path: '/logs/_doc/a1' }],
		['run-search-body', { index: 'logs', body: { query: { match_all: {} }, size: 5 } }, { method: 'POST', path: '/logs/_search', body: { query: { match_all: {} }, size: 5 } }],
		['run-search-uri', { index: 'logs', q: 'status:error', size: 5 }, { method: 'GET', path: '/logs/_search', querystring: { q: 'status:error', size: 5 } }],
		['count', { index: 'logs', query: { term: { status: 'error' } } }, { method: 'POST', path: '/logs/_count', body: { query: { term: { status: 'error' } } } }],
		['validate-query', { index: 'logs', query: { match: { msg: 'x' } } }, { method: 'POST', path: '/logs/_validate/query', querystring: { explain: 'true' }, body: { query: { match: { msg: 'x' } } } }],
		['cluster-health', {}, { method: 'GET', path: '/_cluster/health' }],
		['cluster-stats', {}, { method: 'GET', path: '/_cluster/stats' }],
		['get-allocation', {}, { method: 'GET', path: '/_cat/allocation', querystring: { format: 'json' } }],
		['get-shards', { index: 'logs' }, { method: 'GET', path: '/_cat/shards/logs', querystring: { format: 'json', s: 'index,shard' } }],
		['get-nodes-stats', {}, { method: 'GET', path: '/_nodes/stats/os,jvm,fs' }],
	]

	it('covers all 15 read tools, none needing approval for a first call', () => {
		expect(reads).toHaveLength(15)
		for (const [name] of reads) {
			expect(TOOL_POLICY[name]).toBe('auto')
			const policy = toolApproval[name]
			if (name === 'list-indices') expect(policy({}, {})).toBeUndefined()
			else expect(policy).toBeUndefined()
		}
	})

	it.each(reads)('%s sends the expected request', async (name, input, expected) => {
		es.request = vi.fn(async () => (name.startsWith('list') || name === 'get-allocation' || name === 'get-shards' ? [] : { ok: true }))
		await run(name, input)
		expect(sent()).toEqual([expected])
	})

	it('lists indices largest first in a chosen unit', async () => {
		es.request = vi.fn(async () => [])
		await run('list-indices', { sort: 'store.size:desc', bytes: 'mb' })
		expect(sent()[0].querystring).toMatchObject({ s: 'store.size:desc', bytes: 'mb' })
	})

	it('rejects a malformed sort or unit for the index list', () => {
		const schema = toolDefinitions['list-indices'].inputSchema
		expect(schema.safeParse({ sort: 'store.size:desc,docs.count:asc' }).success).toBe(true)
		expect(schema.safeParse({ sort: 'store.size:sideways' }).success).toBe(false)
		expect(schema.safeParse({ sort: 'x&format=yaml' }).success).toBe(false)
		expect(schema.safeParse({ bytes: 'megabytes' }).success).toBe(false)
	})

	it('counts all documents when no query is given', async () => {
		await run('count', { index: 'logs' })
		expect(sent()).toEqual([{ method: 'POST', path: '/logs/_count' }])
	})

	it('reports a missing document instead of failing', async () => {
		es.request = vi.fn(async () => {
			throw Object.assign(new Error('Not Found'), { meta: { statusCode: 404 } })
		})
		expect(await run('get-document', { index: 'logs', id: 'gone' })).toEqual({ found: false, _index: 'logs', _id: 'gone' })
	})

	it('encodes path segments so a name cannot rewrite the path', async () => {
		await run('get-document', { index: 'logs', id: '../_all/_delete' })
		expect(sent()[0].path).toBe('/logs/_doc/..%2F_all%2F_delete')
	})
})

describe('confirm write tools', () => {
	const writes = [
		['create-index', { index: 'logs', settings: { number_of_shards: 1 } }, { method: 'PUT', path: '/logs', body: { settings: { number_of_shards: 1 } } }],
		['delete-index', { index: 'logs' }, { method: 'DELETE', path: '/logs' }],
		['clone-index', { index: 'logs', target: 'logs-copy' }, { method: 'POST', path: '/logs/_clone/logs-copy' }],
		['close-index', { index: 'logs' }, { method: 'POST', path: '/logs/_close' }],
		['open-index', { index: 'logs' }, { method: 'POST', path: '/logs/_open' }],
		['wipe-index', { index: 'logs' }, { method: 'POST', path: '/logs/_delete_by_query', querystring: { conflicts: 'proceed' }, body: { query: { match_all: {} } } }],
		['update-mapping', { index: 'logs', properties: { status: { type: 'keyword' } } }, { method: 'PUT', path: '/logs/_mapping', body: { properties: { status: { type: 'keyword' } } } }],
		['update-index-settings', { index: 'logs', settings: { index: { number_of_replicas: 0 } } }, { method: 'PUT', path: '/logs/_settings', body: { index: { number_of_replicas: 0 } } }],
		['create-alias', { index: 'logs', alias: 'current' }, { method: 'POST', path: '/logs/_alias/current' }],
		['delete-alias', { index: 'logs', alias: 'current' }, { method: 'DELETE', path: '/logs/_alias/current' }],
		['index-document', { index: 'logs', id: 'a1', document: { msg: 'hi' } }, { method: 'PUT', path: '/logs/_doc/a1', body: { msg: 'hi' } }],
		['update-document', { index: 'logs', id: 'a1', doc: { msg: 'bye' } }, { method: 'POST', path: '/logs/_update/a1', body: { doc: { msg: 'bye' } } }],
		['delete-document', { index: 'logs', id: 'a1' }, { method: 'DELETE', path: '/logs/_doc/a1' }],
	]

	it('covers all 13 named write tools, each pausing for approval', () => {
		expect(writes).toHaveLength(13)
		for (const [name] of writes) expect(toolApproval[name]).toBe('user-approval')
	})

	it.each(writes)('%s sends the expected request once approved', async (name, input, expected) => {
		await run(name, input)
		expect(sent()).toEqual([expected])
	})

	it('indexes a document without an ID by POST', async () => {
		await run('index-document', { index: 'logs', document: { msg: 'hi' } })
		expect(sent()).toEqual([{ method: 'POST', path: '/logs/_doc', body: { msg: 'hi' } }])
	})

	it.each(['delete-index', 'wipe-index', 'delete-document'])(
		'%s refuses targets that reach every index',
		name => {
			for (const index of ['_all', '*', 'logs-*', 'a,b', ' ']) {
				const input = { index, id: 'x' }
				expect(toolDefinitions[name].inputSchema.safeParse(input).success).toBe(false)
			}
			expect(toolDefinitions[name].inputSchema.safeParse({ index: 'logs', id: 'x' }).success).toBe(true)
		}
	)
})

describe('list-indices paging', () => {
	const indices = n => Array.from({ length: n }, (_, i) => ({ index: `idx-${String(i + 1).padStart(3, '0')}` }))

	it('returns page 1 with the total and page count, pointing to the next page', async () => {
		es.request = vi.fn(async () => indices(120))
		const result = await run('list-indices', {})
		expect(result).toMatchObject({ total: 120, page: 1, pages: 3, returned: 50, truncated: true })
		expect(result.rows[0].index).toBe('idx-001')
		expect(result.note).toMatch(/page 1 of 3.*Request page 2.*approve/)
	})

	it('returns a later page', async () => {
		es.request = vi.fn(async () => indices(120))
		const result = await run('list-indices', { page: 2 })
		expect(result).toMatchObject({ page: 2, pages: 3, returned: 50, truncated: true })
		expect(result.rows[0].index).toBe('idx-051')
		expect(result.rows.at(-1).index).toBe('idx-100')
	})

	it('marks the last page complete', async () => {
		es.request = vi.fn(async () => indices(120))
		const result = await run('list-indices', { page: 3 })
		expect(result).toMatchObject({ page: 3, pages: 3, returned: 20 })
		expect(result.truncated).toBeUndefined()
	})

	it('answers a page past the end with an empty page and a note', async () => {
		es.request = vi.fn(async () => indices(120))
		const result = await run('list-indices', { page: 9 })
		expect(result).toMatchObject({ page: 9, pages: 3, returned: 0, rows: [] })
		expect(result.note).toBe('There are only 3 pages.')
	})

	it('keeps the same sorted request on every page', async () => {
		es.request = vi.fn(async () => indices(120))
		await run('list-indices', { sort: 'store.size:desc', page: 1 })
		await run('list-indices', { sort: 'store.size:desc', page: 2 })
		expect(sent()[0]).toEqual(sent()[1])
		expect(sent()[0].querystring.page).toBeUndefined()
	})

	it('pauses for approval on every page after the first', () => {
		const policy = toolApproval['list-indices']
		expect(policy({}, {})).toBeUndefined()
		expect(policy({ page: 1 }, {})).toBeUndefined()
		expect(policy({ page: 2 }, {})).toBe('user-approval')
		expect(policy({ page: 7 }, {})).toBe('user-approval')
	})

	it('rejects a page below 1', () => {
		const schema = toolDefinitions['list-indices'].inputSchema
		expect(schema.safeParse({ page: 0 }).success).toBe(false)
		expect(schema.safeParse({ page: 1.5 }).success).toBe(false)
	})
})

describe('run-es-request', () => {
	it.each(['GET', 'DELETE'])('pauses for approval even for %s', method => {
		expect(toolApproval['run-es-request']).toBe('user-approval')
		expect(toolDefinitions['run-es-request'].inputSchema.safeParse({ method, path: '/_cat/nodes' }).success).toBe(true)
	})

	it('sends a read-shaped request as given', async () => {
		await run('run-es-request', { method: 'GET', path: '_cat/nodes', querystring: { format: 'json' } })
		expect(sent()).toEqual([{ method: 'GET', path: '/_cat/nodes', querystring: { format: 'json' } }])
	})

	it('sends a write-shaped request as given', async () => {
		await run('run-es-request', { method: 'DELETE', path: '/logs-2024' })
		expect(sent()).toEqual([{ method: 'DELETE', path: '/logs-2024' }])
	})

	it('moves a query string in the path into the parameters', async () => {
		await run('run-es-request', { method: 'GET', path: '/_cat/indices?v&s=store.size:desc', querystring: { bytes: 'mb' } })
		expect(sent()).toEqual([
			{ method: 'GET', path: '/_cat/indices', querystring: { v: '', s: 'store.size:desc', bytes: 'mb' } },
		])
	})

	it('rejects an unknown method', () => {
		expect(toolDefinitions['run-es-request'].inputSchema.safeParse({ method: 'PATCH', path: '/x' }).success).toBe(false)
	})
})

describe('propose-query', () => {
	it('normalizes a search proposal without calling Elasticsearch', async () => {
		const result = await run('propose-query', { kind: 'search', index: 'logs', title: 'Errors', body: { query: { term: { level: 'error' } } } })
		expect(result).toEqual({ kind: 'search', mode: 'body', title: 'Errors', index: 'logs', method: 'POST', path: '/logs/_search', body: { query: { term: { level: 'error' } } } })
		expect(es.request).not.toHaveBeenCalled()
	})

	it('normalizes a request proposal', async () => {
		const result = await run('propose-query', { kind: 'request', method: 'PUT', path: 'logs/_mapping', body: { properties: {} } })
		expect(result).toEqual({ kind: 'request', title: undefined, method: 'PUT', path: '/logs/_mapping', body: { properties: {} } })
		expect(es.request).not.toHaveBeenCalled()
	})

	it('carries query parameters on a request proposal', async () => {
		const result = await run('propose-query', {
			kind: 'request',
			title: 'List indices sorted by size (largest first)',
			method: 'GET',
			path: '/_cat/indices',
			querystring: { v: '', s: 'store.size:desc', bytes: 'mb' },
		})
		expect(result).toMatchObject({ path: '/_cat/indices', querystring: { v: '', s: 'store.size:desc', bytes: 'mb' } })
	})

	it('moves a query string written into the path into the parameters', async () => {
		const result = await run('propose-query', { kind: 'request', method: 'GET', path: '/_cat/indices?v&s=store.size:desc' })
		expect(result).toMatchObject({ path: '/_cat/indices', querystring: { v: '', s: 'store.size:desc' } })
	})

	it('accepts the URI search that used to be rejected, as a URI-mode search', async () => {
		const input = {
			kind: 'search',
			title: 'All form_de_v16_* entries submitted in September 2026 (URI query)',
			index: 'form_de_v16_*',
			body: {},
			querystring: {
				q: 'DataEntry_SubmittedAt:[2026-09-01T00:00:00Z TO 2026-10-01T00:00:00Z}',
				size: '50',
				sort: 'DataEntry_SubmittedAt:asc',
			},
		}
		expect(toolDefinitions['propose-query'].inputSchema.safeParse(input).success).toBe(true)
		expect(await run('propose-query', input)).toEqual({
			kind: 'search',
			mode: 'uri',
			title: input.title,
			index: 'form_de_v16_*',
			method: 'GET',
			path: '/form_de_v16_*/_search',
			querystring: input.querystring,
		})
	})

	it('refuses search parameters the Search view has no place for', () => {
		const parsed = toolDefinitions['propose-query'].inputSchema.safeParse({ kind: 'search', index: 'logs', querystring: { q: 'x', format: 'yaml' } })
		expect(parsed.success).toBe(false)
		expect(parsed.error.issues[0].message).toMatch(/only q, size, from, and sort/)
	})

	it('refuses a URI search that also has a body', () => {
		const parsed = toolDefinitions['propose-query'].inputSchema.safeParse({ kind: 'search', index: 'logs', querystring: { q: 'x' }, body: { query: { match_all: {} } } })
		expect(parsed.success).toBe(false)
		expect(parsed.error.issues[0].message).toMatch(/Leave the body out/)
	})

	it('refuses a size or from that is not a whole number', () => {
		const schema = toolDefinitions['propose-query'].inputSchema
		expect(schema.safeParse({ kind: 'search', index: 'logs', querystring: { size: 'fifty' } }).success).toBe(false)
		expect(schema.safeParse({ kind: 'search', index: 'logs', querystring: { from: '-1' } }).success).toBe(false)
	})

	it('rejects malformed proposals', () => {
		const schema = toolDefinitions['propose-query'].inputSchema
		expect(schema.safeParse({ kind: 'search' }).success).toBe(false)
		expect(schema.safeParse({ kind: 'request', method: 'GET' }).success).toBe(false)
		expect(schema.safeParse({ kind: 'nonsense', index: 'x' }).success).toBe(false)
	})
})

describe('result ceiling', () => {
	const rows = n => Array.from({ length: n }, (_, i) => ({ index: `idx-${i}` }))

	it.each(['list-aliases', 'get-shards', 'get-allocation'])('%s cuts lists to the ceiling and marks them', async name => {
		es.request = vi.fn(async () => rows(RESULT_ROW_LIMIT + 70))
		const result = await run(name, {})
		expect(result.rows).toHaveLength(RESULT_ROW_LIMIT)
		expect(result.truncated).toBe(true)
		expect(result.total).toBe(RESULT_ROW_LIMIT + 70)
		expect(result.note).toMatch(/first 50 of 120/)
	})

	it('leaves short lists unmarked', async () => {
		es.request = vi.fn(async () => rows(3))
		const result = await run('list-indices', {})
		expect(result.truncated).toBeUndefined()
		expect(result.rows).toHaveLength(3)
	})

	it('reduces a body search asking for more than the ceiling', async () => {
		es.request = vi.fn(async () => ({ took: 1, hits: { total: { value: 9000 }, hits: [] } }))
		const result = await run('run-search-body', { index: 'logs', body: { size: 500 } })
		expect(sent()[0].body.size).toBe(RESULT_ROW_LIMIT)
		expect(result.truncated).toBe(true)
		expect(result.note).toMatch(/Asked for 500 hits/)
	})

	it('reduces a URI search asking for more than the ceiling', async () => {
		es.request = vi.fn(async () => ({ hits: { total: 0, hits: [] } }))
		await run('run-search-uri', { index: 'logs', size: 1000 })
		expect(sent()[0].querystring.size).toBe(RESULT_ROW_LIMIT)
	})

	it('marks a search matching more documents than it returns', async () => {
		const hits = Array.from({ length: 10 }, (_, i) => ({ _index: 'logs', _id: `${i}`, _score: 1, _source: { i } }))
		es.request = vi.fn(async () => ({ took: 3, hits: { total: { value: 5000, relation: 'eq' }, hits } }))
		const result = await run('run-search-body', { index: 'logs', body: { size: 10 } })
		expect(result.returned).toBe(10)
		expect(result.total).toBe(5000)
		expect(result.truncated).toBe(true)
		expect(result.note).toMatch(/10 of 5000/)
	})

	it('cuts oversized object results to a marked preview', async () => {
		const huge = { properties: Object.fromEntries(Array.from({ length: 5000 }, (_, i) => [`field_${i}`, { type: 'keyword' }])) }
		es.request = vi.fn(async () => huge)
		for (const name of ['get-index', 'get-mapping', 'cluster-stats', 'get-nodes-stats']) {
			const result = await run(name, { index: 'logs' })
			expect(result.truncated).toBe(true)
			expect(result.preview.length).toBe(RESULT_CHAR_LIMIT)
		}
	})
})
