import { describe, it, expect } from 'vitest'
import { splitPathQuery, formatQuery, pathWithQuery, formatRequestLine, buildToolRequest, requiresApproval, describeToolCall, isDestructiveRequest, isDestructiveCall } from './catalog.js'

describe('query string helpers', () => {
	it('leaves a plain path alone', () => {
		expect(splitPathQuery('/_cat/indices')).toEqual({ path: '/_cat/indices' })
		expect(splitPathQuery('_cat/indices')).toEqual({ path: '/_cat/indices' })
	})

	it('moves a query string out of the path, keeping bare flags', () => {
		expect(splitPathQuery('/_cat/indices?v&s=store.size:desc&bytes=mb')).toEqual({
			path: '/_cat/indices',
			querystring: { v: '', s: 'store.size:desc', bytes: 'mb' },
		})
	})

	it('merges path parameters with explicit ones, explicit winning', () => {
		expect(splitPathQuery('/_cat/indices?s=index&v', { s: 'docs.count:desc' })).toEqual({
			path: '/_cat/indices',
			querystring: { s: 'docs.count:desc', v: '' },
		})
	})

	it('formats parameters readably', () => {
		expect(formatQuery({ v: '', s: 'store.size:desc,index', h: 'index,store.size', index: 'logs-*' })).toBe(
			'v&s=store.size:desc,index&h=index,store.size&index=logs-*'
		)
		expect(formatQuery({ q: 'a b&c' })).toBe('q=a%20b%26c')
		expect(formatQuery(undefined)).toBe('')
	})

	it('appends parameters to a path only when there are any', () => {
		expect(pathWithQuery({ path: '/_cat/indices', querystring: { v: '', bytes: 'mb' } })).toBe('/_cat/indices?v&bytes=mb')
		expect(pathWithQuery({ path: '/_cat/indices', querystring: {} })).toBe('/_cat/indices')
		expect(formatRequestLine({ method: 'GET', path: '/_cat/indices', querystring: { v: '' } })).toBe('GET /_cat/indices?v')
	})
})

describe('buildToolRequest', () => {
	it('sorts and sizes the index list when asked', () => {
		expect(buildToolRequest('list-indices', { index: 'logs-*', sort: 'store.size:desc', bytes: 'mb' })).toEqual({
			method: 'GET',
			path: '/_cat/indices/logs-*',
			querystring: { format: 'json', h: 'index,health,status,docs.count,store.size,pri,rep', s: 'store.size:desc', bytes: 'mb' },
		})
	})

	it('never gives the generic request two question marks', () => {
		const request = buildToolRequest('run-es-request', {
			method: 'GET',
			path: '/_cat/indices?v&s=store.size:desc',
			querystring: { bytes: 'mb' },
		})
		expect(request.path).toBe('/_cat/indices')
		expect(request.querystring).toEqual({ v: '', s: 'store.size:desc', bytes: 'mb' })
		expect(formatRequestLine(request)).toBe('GET /_cat/indices?v&s=store.size:desc&bytes=mb')
	})
})

describe('approval for paged listings', () => {
	it('asks for pages after the first and for every write', () => {
		expect(requiresApproval('list-indices', {})).toBe(false)
		expect(requiresApproval('list-indices', { page: 1 })).toBe(false)
		expect(requiresApproval('list-indices', { page: 2 })).toBe(true)
		expect(requiresApproval('cluster-health', { page: 2 })).toBe(false)
		expect(requiresApproval('delete-index', { index: 'x' })).toBe(true)
	})

	it('describes which entries a page approval sends', () => {
		expect(describeToolCall('list-indices', { page: 3 })).toBe('Page 3: entries 101–150. Approving sends them to the AI provider.')
		expect(describeToolCall('list-indices', { page: 1 })).toBe(null)
		expect(describeToolCall('delete-index', { index: 'x' })).toBe(null)
	})
})

describe('destructive requests', () => {
	it('recognizes deletes and by-query rewrites from the request itself', () => {
		expect(isDestructiveRequest({ method: 'DELETE', path: '/logs' })).toBe(true)
		expect(isDestructiveRequest({ method: 'POST', path: '/logs-*/_delete_by_query' })).toBe(true)
		expect(isDestructiveRequest({ method: 'POST', path: '/logs/_update_by_query' })).toBe(true)
		expect(isDestructiveRequest({ method: 'GET', path: '/logs/_search' })).toBe(false)
		expect(isDestructiveRequest({ method: 'POST', path: '/logs/_doc' })).toBe(false)
	})

	it('treats a generic request by what it does, not by its tool name', () => {
		expect(isDestructiveCall('run-es-request', { method: 'POST', path: '/logs-*/_delete_by_query', body: { query: { match_all: {} } } })).toBe(true)
		expect(isDestructiveCall('run-es-request', { method: 'GET', path: '/_cat/nodes' })).toBe(false)
		expect(isDestructiveCall('delete-index', { index: 'logs' })).toBe(true)
	})

	it('names what a sweeping destructive request will hit', () => {
		expect(describeToolCall('run-es-request', { method: 'POST', path: '/logs-*/_delete_by_query' })).toBe('Affects every index matching logs-*.')
		expect(describeToolCall('run-es-request', { method: 'DELETE', path: '/_all' })).toBe('Affects every index in the cluster.')
		expect(describeToolCall('run-es-request', { method: 'DELETE', path: '/logs' })).toBe(null)
	})
})
