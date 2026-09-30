import { z } from 'zod'
import { openObject } from './schemas.js'
import { RESULT_ROW_LIMIT, capRows, clampSize, describePage, pageRows } from './limits.js'
import { roleGrants } from './roleFilters.js'
import { lacksQueryEndpoint } from '../../security/queryEndpoint.js'
import { compareRoleNames, searchAndSortRoles } from '../../../security/roleSearch.js'
import { RESULT_WINDOW, beyondResultWindow } from '../../../ai/catalog.js'

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

const toRoleSummary = (name, role) => ({
	name,
	...(role?.description ? { description: role.description } : {}),
	cluster: role?.cluster ?? [],
	indices: (role?.indices ?? []).map(block => ({
		names: block?.names ?? [],
		privileges: block?.privileges ?? [],
		restricts_documents: Boolean(block?.query),
		restricts_fields: Boolean(block?.field_security),
	})),
	run_as: role?.run_as ?? [],
	reserved: Boolean(role?.metadata?._reserved),
})

const LOOKUP_LIMIT = 20

// Walking the pages of a filtered role list, or of the users, reads the same
// whole list each time; on a cluster with thousands of roles over a slow link
// that is tens of seconds per page. A read is reused for the same cluster and
// account for a short while, which also bounds how stale it can get.
const WHOLE_LIST_TTL_MS = 2 * 60 * 1000
const wholeLists = new Map()

const readWhole = (send, request) => {
	if (!send.connectionKey) return send(request)
	const key = `${send.connectionKey}|${request.method} ${request.path}`
	const cached = wholeLists.get(key)
	if (cached && Date.now() - cached.at < WHOLE_LIST_TTL_MS) return cached.answer
	const answer = send(request)
	wholeLists.set(key, { at: Date.now(), answer })
	answer.catch(() => wholeLists.delete(key))
	return answer
}

export const forgetWholeLists = () => wholeLists.clear()

// Which privilege names are cluster privileges and which index privileges, so
// an `all` of one kind is not taken to grant the other. Read from the cluster,
// never from a list compiled into the app.
const privilegeKinds = async send => {
	try {
		const builtin = await readWhole(send, { method: 'GET', path: '/_security/privilege/_builtin' })
		return { cluster: new Set(builtin?.cluster ?? []), index: new Set(builtin?.index ?? []) }
	} catch {
		return {}
	}
}

const pastWindowNote = (page, alternative) =>
	`Elasticsearch pages a search only through its first ${RESULT_WINDOW} entries, so page ${page} cannot be fetched. ${alternative}`

// A page answered by the cluster's search; past the window only a narrower
// search, or reading the whole list, can reach the rest.
const describeSearchPage = (rows, total, page, alternative) => {
	const result = describePage(rows, total, page)
	if (total > RESULT_WINDOW) {
		result.note = `${result.note ?? ''} Only the first ${RESULT_WINDOW} of ${total} can be paged this way. ${alternative}`.trim()
	}
	return result
}

// The cluster answers only the names that exist, and 404 when none do. A 404
// here means "not found", which the model would otherwise read as a failure.
const lookUpByName = async (send, request, asked, noun) => {
	let payload
	try {
		payload = await send(request)
	} catch (err) {
		if (err?.meta?.statusCode !== 404) throw err
		payload = {}
	}
	const found = stripCredentialsFromRecords(payload)
	const missing = asked.filter(name => !Object.hasOwn(found, name))
	const result = { found, missing }
	if (!Object.keys(found).length) result.note = `None of the requested ${noun} exist on this cluster.`
	return result
}

const names = what =>
	z.array(z.string().min(1)).min(1).max(LOOKUP_LIMIT).describe(`${what}, up to ${LOOKUP_LIMIT} in one call`)

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
		description: `List the cluster's users, ${RESULT_ROW_LIMIT} per page in username order, each with roles, enabled state, full name, and email. search narrows to users whose username, full name, email, or any role name contains it, and applies before paging, so answer from page 1 by searching when you can; each later page needs the user's approval. Rows are summaries; get-security-user returns full records. This covers the native and reserved realms only: users from LDAP, Active Directory, SAML, or the file realm are not visible to this API. Read-only.`,
		inputSchema: z.object({
			search: z.string().min(1).optional().describe('Text to look for in username, full name, email, or role names'),
			page: z.number().int().min(1).optional().describe('Page to return, starting at 1'),
		}),
		// The user query leaves reserved users out, so the whole list is read.
		run: async (input, send, request) => {
			const users = stripCredentialsFromRecords(await readWhole(send, request))
			const text = input.search?.toLowerCase()
			const rows = Object.entries(users || {})
				.map(([username, user]) => ({
					username,
					roles: user?.roles ?? [],
					enabled: user?.enabled,
					full_name: user?.full_name ?? undefined,
					email: user?.email ?? undefined,
					reserved: Boolean(user?.metadata?._reserved),
				}))
				.filter(
					user =>
						!text ||
						[user.username, user.full_name, user.email, ...user.roles].some(value =>
							String(value ?? '').toLowerCase().includes(text)
						)
				)
				.sort((a, b) => compareRoleNames(a.username, b.username))
			return pageRows(rows, input.page ?? 1)
		},
	},
	'list-security-roles': {
		description: `List the cluster's roles, ${RESULT_ROW_LIMIT} per page in name order, each with cluster privileges, index patterns and privileges, and whether it restricts documents or fields. search matches any part of a role name or every word of its description. To find roles that grant access to an index, pass index with a concrete index name; to find roles holding a privilege, pass privilege; together they must hold on the same index entry. The privilege filter matches exact names, counting all as granting every privilege of its own kind (cluster or index), so for a narrow privilege such as index, also try the broader ones such as write. Regular-expression patterns in roles are matched on a best-effort basis. Filters apply before paging, so answer from page 1 when you can; each later page needs the user's approval. If a result says the cluster cannot page roles itself, pass source whole_list for later pages. Rows are summaries; get-security-role returns full definitions, including document queries. Read-only.`,
		inputSchema: z.object({
			search: z.string().min(1).optional().describe('Text to look for in role names and descriptions'),
			index: z.string().min(1).optional().describe('Only roles whose index patterns cover this index name'),
			privilege: z
				.string()
				.min(1)
				.optional()
				.describe('Only roles holding this cluster or index privilege, such as write or manage_security'),
			source: z
				.enum(['whole_list'])
				.optional()
				.describe('Read the whole role list and page it here; set when a result says the cluster cannot page roles'),
			page: z.number().int().min(1).optional().describe('Page to return, starting at 1'),
		}),
		run: async (input, send, request) => {
			const page = input.page ?? 1
			let fellBack = false
			if (request.method === 'POST') {
				if (beyondResultWindow(page)) {
					return { page, returned: 0, rows: [], note: pastWindowNote(page, 'Narrow the list with search, or pass source whole_list to page the whole list here.') }
				}
				try {
					const response = await send(request)
					const rows = (response?.roles ?? []).map(role => toRoleSummary(role.name, role))
					return describeSearchPage(rows, response?.total ?? rows.length, page, 'Narrow with search, or pass source whole_list.')
				} catch (err) {
					if (!lacksQueryEndpoint(err, 'role')) throw err
					// A later page was approved as the request on its card, so it is
					// not swapped for a different one; only page 1 has no card.
					if (page > 1) {
						throw new Error(
							'This cluster cannot page roles itself, so this page was not fetched. Ask for it again with source whole_list, which reads the whole role list.',
							{ cause: err }
						)
					}
					fellBack = true
				}
			}
			const all = stripCredentialsFromRecords(await readWhole(send, { method: 'GET', path: '/_security/role' }))
			const kinds = input.privilege ? await privilegeKinds(send) : {}
			const matching = searchAndSortRoles(
				Object.entries(all || {}).map(([name, role]) => ({ ...role, name })),
				input.search
			).filter(role => (!input.index && !input.privilege) || roleGrants(role, input, kinds))
			const result = pageRows(
				matching.map(role => toRoleSummary(role.name, role)),
				page
			)
			if (fellBack && result.pages > 1) {
				result.note = `${result.note} This cluster cannot page roles itself: pass source whole_list when asking for later pages.`
			}
			return result
		},
	},
	'list-security-api-keys': {
		description: `List the cluster's API keys, ${RESULT_ROW_LIMIT} per page with the newest first, each with its id, owner, and lifecycle dates. search matches any part of a key name, ignoring case, or an owning username exactly. Invalidated keys are left out unless include_invalidated is set. Search before paging when you can; each later page needs the user's approval. Rows are summaries; get-security-api-key returns full records, including a key's own role restrictions. Key secrets are never returned: Elasticsearch shows a secret only when the key is created. Read-only.`,
		inputSchema: z.object({
			search: z.string().min(1).optional().describe('Text to look for in key names, or an exact owning username'),
			include_invalidated: z.boolean().optional().describe('Also list invalidated keys'),
			page: z.number().int().min(1).optional().describe('Page to return, starting at 1'),
		}),
		run: async (input, send, request) => {
			const page = input.page ?? 1
			if (beyondResultWindow(page)) {
				return { page, returned: 0, rows: [], note: pastWindowNote(page, 'Narrow the list with search.') }
			}
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
			return describeSearchPage(rows, response?.total ?? rows.length, page, 'Narrow with search.')
		},
	},
	'get-security-user': {
		description:
			"Get users' full records by username: roles, full name, email, enabled state, and metadata. Fetch several at once, such as every user a question names. Users that do not exist are listed under missing. Follow up with get-security-role on their roles to see what they may do. Read-only.",
		inputSchema: z.object({ usernames: names('Usernames') }),
		run: (input, send, request) => lookUpByName(send, request, input.usernames, 'users'),
	},
	'get-security-role': {
		description:
			"Get roles' full definitions by name: cluster privileges, run-as, and every index entry with its patterns, privileges, document query, and granted and excepted fields, plus applications and metadata. Fetch several at once, such as all of a user's roles. Roles that do not exist, or are defined in a node's roles.yml file, are listed under missing. Read-only.",
		inputSchema: z.object({ names: names('Role names') }),
		run: (input, send, request) => lookUpByName(send, request, input.names, 'roles'),
	},
	'get-security-api-key': {
		description:
			"Get API keys' full records by id, by name, by owning username, or any combination: owner, realm, creation and expiry, metadata, and the key's own role restrictions where the cluster reports them. name accepts wildcards such as ci-* and ignores case; username is exact. Invalidated keys are left out unless include_invalidated is set. Secrets are never returned. Read-only.",
		inputSchema: z
			.object({
				id: z.string().min(1).optional().describe('The key id'),
				name: z.string().min(1).optional().describe('The key name, wildcards allowed'),
				username: z.string().min(1).optional().describe('The username that owns the key'),
				include_invalidated: z.boolean().optional().describe('Also return invalidated keys'),
			})
			.refine(input => input.id || input.name || input.username, {
				message: 'Give at least one of id, name, or username',
			}),
		run: async (_input, send, request) => {
			const response = stripCredentials(await send(request))
			const keys = response?.api_keys ?? []
			const total = response?.total ?? keys.length
			const result = { total, returned: keys.length, keys }
			if (!keys.length) result.note = 'No API key matches.'
			else if (total > keys.length) {
				result.truncated = true
				result.note = `Showing the newest ${keys.length} of ${total} matching keys. Narrow by name or username to see the rest.`
			}
			return result
		},
	},
	'get-nodes-stats': {
		description: 'Get per-node operating system, JVM, and file system statistics.',
		inputSchema: z.object({}),
	},
}
