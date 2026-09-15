/**
 * The assistant's tool catalog, shared by the server and the renderer.
 *
 * The server executes each tool by sending the request built here, and the
 * confirmation card renders the same request, so what the user approves is
 * exactly what runs. This module has no dependencies so the renderer can
 * import it without pulling in server code.
 */

export const AUTO = 'auto'
export const CONFIRM = 'confirm'

export const TOOL_POLICY = {
	'list-indices': AUTO,
	'list-aliases': AUTO,
	'get-index': AUTO,
	'get-mapping': AUTO,
	'get-index-settings': AUTO,
	'get-document': AUTO,
	'run-search-body': AUTO,
	'run-search-uri': AUTO,
	count: AUTO,
	'validate-query': AUTO,
	'cluster-health': AUTO,
	'cluster-stats': AUTO,
	'get-allocation': AUTO,
	'get-shards': AUTO,
	'get-nodes-stats': AUTO,
	'create-index': CONFIRM,
	'delete-index': CONFIRM,
	'clone-index': CONFIRM,
	'close-index': CONFIRM,
	'open-index': CONFIRM,
	'wipe-index': CONFIRM,
	'update-mapping': CONFIRM,
	'update-index-settings': CONFIRM,
	'create-alias': CONFIRM,
	'delete-alias': CONFIRM,
	'index-document': CONFIRM,
	'update-document': CONFIRM,
	'delete-document': CONFIRM,
	'run-es-request': CONFIRM,
	'propose-query': AUTO,
}

export const DESTRUCTIVE_TOOLS = new Set(['delete-index', 'wipe-index', 'delete-document'])

export const TOOL_NAMES = Object.keys(TOOL_POLICY)

export const needsConfirmation = name => TOOL_POLICY[name] === CONFIRM

export const isDestructive = name => DESTRUCTIVE_TOOLS.has(name)

/** Entries per page in paged listings, and the row ceiling for other lists. */
export const LIST_PAGE_SIZE = 50

/**
 * Listings whose first page runs without asking and whose later pages need
 * the user's approval, since each sends another batch of cluster data to the
 * AI provider.
 */
export const PAGED_TOOLS = new Set(['list-indices'])

const pageOf = input => (Number.isInteger(input?.page) && input.page > 0 ? input.page : 1)

/** Whether a call pauses for the user: every write, and any page after the first. */
export const requiresApproval = (name, input) =>
	needsConfirmation(name) || (PAGED_TOOLS.has(name) && pageOf(input) > 1)

/**
 * A plain-language line for the approval card, for calls the request line
 * alone doesn't explain. Returns null when the request says it all.
 */
export const describeToolCall = (name, input) => {
	if (!PAGED_TOOLS.has(name) || pageOf(input) === 1) return null
	const page = pageOf(input)
	const first = (page - 1) * LIST_PAGE_SIZE + 1
	return `Page ${page}: entries ${first}–${first + LIST_PAGE_SIZE - 1}. Approving sends them to the AI provider.`
}

// Encoding each segment keeps a model-supplied name from rewriting the path.
// Commas and wildcards in index patterns survive; Elasticsearch decodes them.
const seg = value => encodeURIComponent(String(value))

const withBody = (request, body) =>
	body === undefined || body === null ? request : { ...request, body }

/**
 * Index targets that would reach every index. Destructive tools refuse them
 * even with approval; the generic request tool remains for a deliberate
 * cluster-wide operation.
 */
export const isSweepingTarget = index => {
	const value = String(index ?? '').trim()
	return !value || value === '_all' || value.includes('*') || value.includes(',')
}

// Encodes a query key or value, leaving the characters Elasticsearch
// parameters use (colons, commas, wildcards) readable.
const encodeQueryPart = value =>
	encodeURIComponent(String(value))
		.replace(/%3A/gi, ':')
		.replace(/%2C/gi, ',')
		.replace(/%2A/gi, '*')

/**
 * Moves any query string written into a path into the parameters, merged
 * with explicit ones (explicit values win), so a request never ends up with
 * two `?`. An empty value, as in `?v`, stays a bare flag.
 */
export const splitPathQuery = (path, querystring) => {
	const value = String(path ?? '')
	const mark = value.indexOf('?')
	const base = mark === -1 ? value : value.slice(0, mark)
	const fromPath = mark === -1 ? {} : Object.fromEntries(new URLSearchParams(value.slice(mark + 1)))
	const merged = { ...fromPath, ...(querystring ?? {}) }
	return {
		path: base.startsWith('/') ? base : `/${base}`,
		...(Object.keys(merged).length ? { querystring: merged } : {}),
	}
}

/** `{ v: '', s: 'store.size:desc' }` becomes `v&s=store.size:desc`. */
export const formatQuery = querystring =>
	Object.entries(querystring ?? {})
		.map(([key, value]) =>
			value === '' || value === null || value === undefined
				? encodeQueryPart(key)
				: `${encodeQueryPart(key)}=${encodeQueryPart(value)}`
		)
		.join('&')

/** A path with its parameters appended, as typed into a URL field. */
export const pathWithQuery = ({ path, querystring } = {}) => {
	const query = formatQuery(querystring)
	return query ? `${path}?${query}` : path
}

const REQUESTS = {
	'list-indices': ({ index, sort, bytes } = {}) => ({
		method: 'GET',
		path: index ? `/_cat/indices/${seg(index)}` : '/_cat/indices',
		querystring: {
			format: 'json',
			h: 'index,health,status,docs.count,store.size,pri,rep',
			s: sort || 'index',
			...(bytes ? { bytes } : {}),
		},
	}),
	'list-aliases': () => ({
		method: 'GET',
		path: '/_cat/aliases',
		querystring: { format: 'json', s: 'alias' },
	}),
	'get-index': ({ index }) => ({ method: 'GET', path: `/${seg(index)}` }),
	'get-mapping': ({ index }) => ({ method: 'GET', path: `/${seg(index)}/_mapping` }),
	'get-index-settings': ({ index }) => ({ method: 'GET', path: `/${seg(index)}/_settings` }),
	'get-document': ({ index, id }) => ({
		method: 'GET',
		path: `/${seg(index)}/_doc/${seg(id)}`,
	}),
	'run-search-body': ({ index, body }) => ({
		method: 'POST',
		path: `/${seg(index)}/_search`,
		body: body ?? {},
	}),
	'run-search-uri': ({ index, q, size, from, sort }) => ({
		method: 'GET',
		path: `/${seg(index)}/_search`,
		querystring: Object.fromEntries(
			Object.entries({ q, size, from, sort }).filter(([, value]) => value !== undefined)
		),
	}),
	count: ({ index, query }) =>
		withBody({ method: 'POST', path: `/${seg(index)}/_count` }, query ? { query } : undefined),
	'validate-query': ({ index, query }) => ({
		method: 'POST',
		path: `/${seg(index)}/_validate/query`,
		querystring: { explain: 'true' },
		body: { query },
	}),
	'cluster-health': () => ({ method: 'GET', path: '/_cluster/health' }),
	'cluster-stats': () => ({ method: 'GET', path: '/_cluster/stats' }),
	'get-allocation': () => ({
		method: 'GET',
		path: '/_cat/allocation',
		querystring: { format: 'json' },
	}),
	'get-shards': ({ index } = {}) => ({
		method: 'GET',
		path: index ? `/_cat/shards/${seg(index)}` : '/_cat/shards',
		querystring: { format: 'json', s: 'index,shard' },
	}),
	'get-nodes-stats': () => ({ method: 'GET', path: '/_nodes/stats/os,jvm,fs' }),

	'create-index': ({ index, settings, mappings, aliases }) => {
		const body = Object.fromEntries(
			Object.entries({ settings, mappings, aliases }).filter(([, value]) => value !== undefined)
		)
		return withBody(
			{ method: 'PUT', path: `/${seg(index)}` },
			Object.keys(body).length ? body : undefined
		)
	},
	'delete-index': ({ index }) => ({ method: 'DELETE', path: `/${seg(index)}` }),
	'clone-index': ({ index, target }) => ({
		method: 'POST',
		path: `/${seg(index)}/_clone/${seg(target)}`,
	}),
	'close-index': ({ index }) => ({ method: 'POST', path: `/${seg(index)}/_close` }),
	'open-index': ({ index }) => ({ method: 'POST', path: `/${seg(index)}/_open` }),
	'wipe-index': ({ index }) => ({
		method: 'POST',
		path: `/${seg(index)}/_delete_by_query`,
		querystring: { conflicts: 'proceed' },
		body: { query: { match_all: {} } },
	}),
	'update-mapping': ({ index, properties }) => ({
		method: 'PUT',
		path: `/${seg(index)}/_mapping`,
		body: { properties },
	}),
	'update-index-settings': ({ index, settings }) => ({
		method: 'PUT',
		path: `/${seg(index)}/_settings`,
		body: settings,
	}),
	'create-alias': ({ index, alias, filter, is_write_index }) => {
		const body = Object.fromEntries(
			Object.entries({ filter, is_write_index }).filter(([, value]) => value !== undefined)
		)
		return withBody(
			{ method: 'POST', path: `/${seg(index)}/_alias/${seg(alias)}` },
			Object.keys(body).length ? body : undefined
		)
	},
	'delete-alias': ({ index, alias }) => ({
		method: 'DELETE',
		path: `/${seg(index)}/_alias/${seg(alias)}`,
	}),
	'index-document': ({ index, id, document }) =>
		id === undefined || id === ''
			? { method: 'POST', path: `/${seg(index)}/_doc`, body: document }
			: { method: 'PUT', path: `/${seg(index)}/_doc/${seg(id)}`, body: document },
	'update-document': ({ index, id, doc }) => ({
		method: 'POST',
		path: `/${seg(index)}/_update/${seg(id)}`,
		body: { doc },
	}),
	'delete-document': ({ index, id }) => ({
		method: 'DELETE',
		path: `/${seg(index)}/_doc/${seg(id)}`,
	}),
	'run-es-request': ({ method, path, querystring, body, headers }) => {
		const request = { method, ...splitPathQuery(path, querystring) }
		if (headers && Object.keys(headers).length) request.headers = headers
		return withBody(request, body)
	},
}

/** The exact request a tool sends for this input, or null for non-ES tools. */
export const buildToolRequest = (name, input = {}) => REQUESTS[name]?.(input) ?? null

/** Formats a request the way the confirmation and query cards show it. */
export const formatRequestLine = ({ method, path, querystring } = {}) =>
	`${method} ${pathWithQuery({ path, querystring })}`
