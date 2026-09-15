import { z } from 'zod'
import { openObject } from './schemas.js'
import { isSweepingTarget } from '../../../ai/catalog.js'

const index = z.string().min(1).describe('Index name')
const object = description => openObject().describe(description)

// Destructive tools refuse targets that reach every index, even with approval.
const singleIndex = index.refine(value => !isSweepingTarget(value), {
	message: 'Name one index. _all, wildcards, and comma-separated lists are refused.',
})

export const writeTools = {
	'create-index': {
		description: 'Create an index, optionally with settings, mappings, and aliases.',
		inputSchema: z.object({
			index,
			settings: object('Index settings, such as { "number_of_shards": 1 }').optional(),
			mappings: object('Mappings, such as { "properties": { "title": { "type": "text" } } }').optional(),
			aliases: object('Aliases, such as { "my-alias": {} }').optional(),
		}),
	},
	'delete-index': {
		description: 'Delete one index and all of its documents. This cannot be undone.',
		inputSchema: z.object({ index: singleIndex }),
	},
	'clone-index': {
		description: 'Clone an existing index into a new index. The source index must be read-only.',
		inputSchema: z.object({ index, target: z.string().min(1).describe('Name of the new index') }),
	},
	'close-index': {
		description: 'Close an index so it can no longer be read or written.',
		inputSchema: z.object({ index }),
	},
	'open-index': {
		description: 'Open a closed index.',
		inputSchema: z.object({ index }),
	},
	'wipe-index': {
		description: 'Delete every document in one index while keeping the index and its mappings. This cannot be undone.',
		inputSchema: z.object({ index: singleIndex }),
	},
	'update-mapping': {
		description: 'Add fields to an index mapping. Existing field types cannot be changed.',
		inputSchema: z.object({
			index,
			properties: object('Field definitions, such as { "status": { "type": "keyword" } }'),
		}),
	},
	'update-index-settings': {
		description: 'Change dynamic index settings, such as the replica count.',
		inputSchema: z.object({
			index,
			settings: object('Settings to change, such as { "index": { "number_of_replicas": 1 } }'),
		}),
	},
	'create-alias': {
		description: 'Point an alias at an index, optionally with a filter.',
		inputSchema: z.object({
			index,
			alias: z.string().min(1),
			filter: object('A Query DSL filter for the alias').optional(),
			is_write_index: z.boolean().optional(),
		}),
	},
	'delete-alias': {
		description: 'Remove an alias from an index.',
		inputSchema: z.object({ index, alias: z.string().min(1) }),
	},
	'index-document': {
		description: 'Add a document, or replace the document with the given ID.',
		inputSchema: z.object({
			index,
			id: z.string().optional().describe('Document ID; omit to let Elasticsearch assign one'),
			document: object('The document body'),
		}),
	},
	'update-document': {
		description: 'Update some fields of an existing document.',
		inputSchema: z.object({
			index,
			id: z.string().min(1),
			doc: object('The fields to change'),
		}),
	},
	'delete-document': {
		description: 'Delete one document by ID. This cannot be undone.',
		inputSchema: z.object({ index: singleIndex, id: z.string().min(1) }),
	},
}
