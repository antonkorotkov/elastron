import { z } from 'zod'
import { openObject } from './schemas.js'
import { splitPathQuery } from '../../../ai/catalog.js'

// A search proposal with these URL parameters is a URI search, which the
// Search view holds in its URI mode. It has nowhere to put any others.
export const SEARCH_URI_PARAMS = ['q', 'size', 'from', 'sort']

const isEmptyBody = body =>
	body === undefined ||
	body === null ||
	(typeof body === 'object' && !Array.isArray(body) && Object.keys(body).length === 0)

const isCount = value => value === undefined || /^\d+$/.test(value)

const proposal = z
	.object({
		kind: z
			.enum(['search', 'request'])
			.describe('"search" for a search against one index; "request" for any other request'),
		title: z.string().max(120).optional().describe('A short label for the query card'),
		index: z.string().min(1).optional().describe('Required for kind "search"'),
		method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'HEAD']).optional().describe('Required for kind "request"'),
		path: z.string().min(1).optional().describe('Required for kind "request", such as /my-index/_mapping'),
		querystring: openObject(z.string())
			.optional()
			.describe('URL parameters. Put them here, not in the path or the body; an empty value is a flag like ?v. For kind "request", any, such as { "v": "", "s": "store.size:desc", "bytes": "mb" }. For kind "search", only q, size, from, and sort, which make it a URI search, such as { "q": "status:error", "size": "50", "sort": "@timestamp:desc" }; leave the body out then'),
		body: z.unknown().optional().describe('The request body; for a search, the full search body'),
	})
	.refine(value => value.kind !== 'search' || Boolean(value.index), {
		message: 'A search proposal needs an index.',
		path: ['index'],
	})
	.refine(
		value =>
			value.kind !== 'search' ||
			!value.querystring ||
			Object.keys(value.querystring).every(key => SEARCH_URI_PARAMS.includes(key)),
		{
			message: 'A search proposal takes only q, size, from, and sort as URL parameters. Use kind "request" for others.',
			path: ['querystring'],
		}
	)
	.refine(value => value.kind !== 'search' || !value.querystring || isEmptyBody(value.body), {
		message: 'A URI search takes its query in q. Leave the body out, or drop querystring for a body search.',
		path: ['body'],
	})
	.refine(
		value =>
			value.kind !== 'search' || (isCount(value.querystring?.size) && isCount(value.querystring?.from)),
		{ message: 'size and from must be whole numbers, such as "50".', path: ['querystring'] }
	)
	.refine(value => value.kind !== 'request' || (value.method && value.path), {
		message: 'A request proposal needs a method and a path.',
		path: ['path'],
	})

/** Normalizes a proposal so the query card always gets method, path, and body. */
export const normalizeProposal = input => {
	if (input.kind === 'search' && input.querystring) {
		// A URI search: the query travels in q, as the Search view's URI mode does.
		return {
			kind: 'search',
			mode: 'uri',
			title: input.title,
			index: input.index,
			method: 'GET',
			path: `/${encodeURIComponent(input.index)}/_search`,
			querystring: Object.fromEntries(
				SEARCH_URI_PARAMS.filter(key => input.querystring[key] !== undefined).map(key => [key, input.querystring[key]])
			),
		}
	}
	if (input.kind === 'search') {
		return {
			kind: 'search',
			mode: 'body',
			title: input.title,
			index: input.index,
			method: 'POST',
			path: `/${encodeURIComponent(input.index)}/_search`,
			body: input.body ?? { query: { match_all: {} } },
		}
	}
	// A query string written into the path moves into the parameters.
	return {
		kind: 'request',
		title: input.title,
		method: input.method,
		...splitPathQuery(input.path, input.querystring),
		body: input.body,
	}
}

export const proposeTools = {
	'propose-query': {
		description:
			'Hand a finished query or request to the user as a card they can open in the Search view or the Playground. Does not run anything. Use it after running a search the user wants to see the results of, or when the user wants to run or edit a query themselves; to make a change the user asked for, call the matching tool instead.',
		inputSchema: proposal,
		run: async input => normalizeProposal(input),
		local: true,
	},
}
