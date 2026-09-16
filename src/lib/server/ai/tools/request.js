import { z } from 'zod'
import { openObject } from './schemas.js'

export const requestTools = {
	'run-es-request': {
		description:
			'Send any Elasticsearch API request not covered by another tool, such as reindex, update or delete by query, index templates, lifecycle policies, snapshots, or cluster settings. Whatever the method, the user sees the exact request.',
		inputSchema: z.object({
			method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'HEAD']),
			path: z.string().min(1).describe('The API path, such as /_cat/nodes or /my-index/_stats'),
			querystring: openObject(z.string()).optional(),
			body: z.unknown().optional().describe('The JSON request body, if any'),
			headers: openObject(z.string()).optional(),
		}),
	},
}
