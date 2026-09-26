import { z } from 'zod'
import { openObject } from './schemas.js'
import { RESULT_ROW_LIMIT, capRows, clampSize, pageRows } from './limits.js'

const index = z.string().min(1).describe('Index name, alias, or pattern such as logs-*')
const query = openObject()
	.describe('An Elasticsearch Query DSL query object, such as { "match": { "title": "foo" } }')

const totalOf = hits =>
	typeof hits?.total === 'object' ? hits.total.value : hits?.total

const shapeSearch = (response, note) => {
	const hits = response?.hits?.hits ?? []
	const total = totalOf(response?.hits)
	const result = {
		took: response?.took,
		total,
		returned: hits.length,
		hits: hits.map(({ _index, _id, _score, _source, highlight, fields, sort }) =>
			Object.fromEntries(
				Object.entries({ _index, _id, _score, _source, highlight, fields, sort }).filter(
					([, value]) => value !== undefined
				)
			)
		),
	}
	if (response?.aggregations) result.aggregations = response.aggregations
	const notes = [note]
	if (Number.isFinite(total) && total > hits.length) {
		result.truncated = true
		notes.push(`Showing ${hits.length} of ${total} matching documents.`)
	}
	const text = notes.filter(Boolean).join(' ')
	if (text) result.note = text
	if (note) result.truncated = true
	return result
}

const sizeNote = size =>
	Number.isFinite(size) && size > RESULT_ROW_LIMIT
		? `Asked for ${size} hits; results are capped at ${RESULT_ROW_LIMIT}.`
		: undefined


/**
 * Fields that must never leave the cluster for the AI provider.
 *
 * Elasticsearch does not return password hashes from the user API, and does
 * not return a key's secret from the API key listing, so today this filter
 * removes nothing. It is here so the guarantee does not depend on that
 * staying true, and so a future field cannot leak by default.
 */
const CREDENTIAL_FIELDS = new Set([
	'password',
	'password_hash',
	'api_key',
	'encoded',
	'access_token',
	'refresh_token',
	'authentication',
])

const stripCredentials = value => {
	if (Array.isArray(value)) return value.map(stripCredentials)
	if (!value || typeof value !== 'object') return value
	return Object.fromEntries(
		Object.entries(value)
			.filter(([key]) => !CREDENTIAL_FIELDS.has(key))
			.map(([key, entry]) => [key, stripCredentials(entry)])
	)
}

/**
 * The user and role listings are keyed by name, so filtering their top level
 * would delete a role actually called `password` or `api_key` and leave the
 * assistant reporting that the cluster does not have it. Only the records
 * themselves are filtered.
 */
const stripCredentialsFromRecords = payload =>
	Object.fromEntries(
		Object.entries(payload || {}).map(([name, record]) => [name, stripCredentials(record)])
	)

export const readTools = {
	'list-indices': {
		description: `List indices with health, status, document count, size, and shard counts, ${RESULT_ROW_LIMIT} per page. The result gives the total and the number of pages; page 1 runs at once, and each later page needs the user's approval, so prefer sort and index filters that answer the question from page 1. Sort with sort, such as store.size:desc for the largest first or docs.count:desc for the most documents; the default is by name. Sizes are human-readable (like 13.6kb) unless bytes sets a unit, which makes them plain numbers you can compare.`,
		inputSchema: z.object({
			index: index.optional().describe('Only indices matching this name or pattern, such as logs-*'),
			sort: z
				.string()
				.regex(/^[\w.]+(:(asc|desc))?(,[\w.]+(:(asc|desc))?)*$/, 'Use column:asc or column:desc, comma-separated')
				.optional()
				.describe('Column to sort by, such as store.size:desc or docs.count:desc'),
			bytes: z.enum(['b', 'kb', 'mb', 'gb', 'tb', 'pb']).optional().describe('Unit for store.size'),
			page: z.number().int().min(1).optional().describe('Page to return, starting at 1'),
		}),
		// Elasticsearch can't page this listing, so the full sorted list is
		// fetched each time and one page is returned; the order is stable.
		run: async (input, send, request) => pageRows(await send(request), input.page ?? 1),
	},
	'list-aliases': {
		description: 'List the aliases on the cluster and the indices they point to.',
		inputSchema: z.object({}),
		run: async (_input, send, request) => capRows(await send(request)),
	},
	'get-index': {
		description: "Get an index's full definition: its settings, mappings, and aliases.",
		inputSchema: z.object({ index }),
	},
	'get-mapping': {
		description: "Get an index's field mappings. Use this to learn field names and types before building a query.",
		inputSchema: z.object({ index }),
	},
	'get-index-settings': {
		description: "Get an index's settings, such as shard and replica counts and analyzers.",
		inputSchema: z.object({ index }),
	},
	'get-document': {
		description: 'Get one document by its ID.',
		inputSchema: z.object({ index, id: z.string().min(1).describe('The document ID') }),
		run: async (input, send, request) => {
			try {
				return await send(request)
			} catch (err) {
				if (err?.meta?.statusCode === 404) return { found: false, _index: input.index, _id: input.id }
				throw err
			}
		},
	},
	'run-search-body': {
		description: `Run a search with a full Query DSL request body, which may include query, aggs, sort, size, from, and _source. At most ${RESULT_ROW_LIMIT} hits are returned.`,
		inputSchema: z.object({
			index,
			body: openObject()
				.describe('The search request body, such as { "query": { ... }, "size": 10 }'),
		}),
		prepare: input =>
			Number.isFinite(input.body?.size) && input.body.size > RESULT_ROW_LIMIT
				? { ...input, body: { ...input.body, size: clampSize(input.body.size) } }
				: input,
		run: async (_input, send, request, original) =>
			shapeSearch(await send(request), sizeNote(original.body?.size)),
	},
	'run-search-uri': {
		description: `Run a simple search using Lucene query-string syntax, such as status:error AND service:api. At most ${RESULT_ROW_LIMIT} hits are returned.`,
		inputSchema: z.object({
			index,
			q: z.string().optional().describe('Lucene query string; omit to match all documents'),
			size: z.number().int().min(0).optional(),
			from: z.number().int().min(0).optional(),
			sort: z.string().optional().describe('Sort such as timestamp:desc'),
		}),
		prepare: input =>
			Number.isFinite(input.size) && input.size > RESULT_ROW_LIMIT
				? { ...input, size: clampSize(input.size) }
				: input,
		run: async (_input, send, request, original) =>
			shapeSearch(await send(request), sizeNote(original.size)),
	},
	count: {
		description: 'Count the documents in an index, optionally only those matching a query.',
		inputSchema: z.object({ index, query: query.optional() }),
	},
	'validate-query': {
		description:
			'Check whether a query is valid for an index before proposing it. Returns valid: false with an explanation when it is not.',
		inputSchema: z.object({ index, query }),
	},
	'cluster-health': {
		description: "Get the cluster's health: status, node counts, and shard allocation summary.",
		inputSchema: z.object({}),
	},
	'cluster-stats': {
		description: 'Get cluster-wide statistics about indices, documents, storage, and nodes.',
		inputSchema: z.object({}),
	},
	'get-allocation': {
		description: 'Get disk usage and shard counts per node.',
		inputSchema: z.object({}),
		run: async (_input, send, request) => capRows(await send(request)),
	},
	'get-shards': {
		description: 'List shards with their state, size, and node, optionally for one index.',
		inputSchema: z.object({ index: index.optional() }),
		run: async (_input, send, request) => capRows(await send(request)),
	},
	'list-security-users': {
		description:
			"List the cluster's users with their roles and whether each is enabled. This covers the native and reserved realms only: users from LDAP, Active Directory, SAML, or the file realm are not visible to this API, so a cluster can have people who do not appear here. Read-only; users cannot be changed by the assistant.",
		inputSchema: z.object({}),
		run: async (_input, send, request) => {
			const users = stripCredentialsFromRecords(await send(request))
			const rows = Object.entries(users || {}).map(([username, user]) => ({
				username,
				roles: user?.roles ?? [],
				enabled: user?.enabled,
				full_name: user?.full_name ?? undefined,
				email: user?.email ?? undefined,
				reserved: Boolean(user?.metadata?._reserved),
			}))
			return capRows(rows)
		},
	},
	'list-security-roles': {
		description:
			"List the cluster's roles with their cluster privileges, the index patterns they grant, and whether they restrict which documents or fields their holders can see. Read-only; roles cannot be changed by the assistant.",
		inputSchema: z.object({}),
		run: async (_input, send, request) => {
			const roles = stripCredentialsFromRecords(await send(request))
			const rows = Object.entries(roles || {}).map(([name, role]) => ({
				name,
				cluster: role?.cluster ?? [],
				indices: (role?.indices ?? []).map(block => ({
					names: block?.names ?? [],
					privileges: block?.privileges ?? [],
					restricts_documents: Boolean(block?.query),
					restricts_fields: Boolean(block?.field_security),
				})),
				run_as: role?.run_as ?? [],
				reserved: Boolean(role?.metadata?._reserved),
			}))
			return capRows(rows)
		},
	},
	'list-security-api-keys': {
		description:
			'List the cluster\'s API keys with their owner and lifecycle dates. Key secrets are never returned: Elasticsearch shows a secret only when the key is created. Read-only; keys cannot be created or invalidated by the assistant.',
		inputSchema: z.object({}),
		run: async (_input, send, request) => {
			const response = stripCredentials(await send(request))
			const rows = (response?.api_keys ?? []).map(key => ({
				id: key?.id,
				name: key?.name,
				username: key?.username,
				realm: key?.realm,
				creation: key?.creation,
				expiration: key?.expiration,
				invalidated: Boolean(key?.invalidated),
			}))
			return capRows(rows)
		},
	},
	'get-nodes-stats': {
		description: 'Get per-node operating system, JVM, and file system statistics.',
		inputSchema: z.object({}),
	},
}
