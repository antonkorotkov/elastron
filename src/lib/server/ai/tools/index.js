import { tool } from 'ai'
import { buildToolRequest, needsConfirmation, requiresApproval, PAGED_TOOLS, TOOL_NAMES } from '../../../ai/catalog.js'
import { withElasticClient, getErrorReason } from '../../elastic.js'
import { capSize } from './limits.js'
import { readTools } from './read.js'
import { writeTools } from './write.js'
import { requestTools } from './request.js'
import { proposeTools } from './propose.js'

/**
 * Tool definitions: description, input schema, and an optional `prepare`
 * (adjust input before the request is built) and `run` (shape the result,
 * given the prepared input, a send function, the request, and the model's
 * original input).
 * They don't depend on the AI SDK, so a future MCP server could reuse them.
 */
export const toolDefinitions = { ...readTools, ...writeTools, ...requestTools, ...proposeTools }

/**
 * Every confirm-policy tool pauses for the user before it runs, and a paged
 * listing pauses for any page after the first.
 */
export const toolApproval = Object.fromEntries(
	TOOL_NAMES.flatMap(name => {
		if (needsConfirmation(name)) return [[name, 'user-approval']]
		if (PAGED_TOOLS.has(name)) {
			return [[name, input => (requiresApproval(name, input) ? 'user-approval' : undefined)]]
		}
		return []
	})
)

/**
 * Appended to every tool that changes the cluster. Models decide whether to
 * call a tool largely from its description, and without this they tend to
 * describe the change for the user to make by hand.
 */
export const APPROVAL_NOTE =
	"It pauses for the user's approval before running, so call it directly when the user asks for this change instead of describing the steps."

const describe = (name, definition) =>
	needsConfirmation(name) ? `${definition.description} ${APPROVAL_NOTE}` : definition.description

const unwrap = response => (response?.body !== undefined ? response.body : response)

/**
 * Binds the tool set to one connection and window, so every request goes
 * through that window's SSH tunnel when it has one.
 */
export const createAssistantTools = ({ connection, windowId }) => {
	const send = request =>
		withElasticClient(connection, windowId, async client => unwrap(await client.transport.request(request)))

	return Object.fromEntries(
		Object.entries(toolDefinitions).map(([name, definition]) => [
			name,
			tool({
				description: describe(name, definition),
				inputSchema: definition.inputSchema,
				execute: async rawInput => {
					const input = definition.prepare ? definition.prepare(rawInput) : rawInput
					try {
						if (definition.local) return capSize(await definition.run(input))
						const request = buildToolRequest(name, input)
						const result = definition.run
							? await definition.run(input, send, request, rawInput)
							: await send(request)
						return capSize(result)
					} catch (err) {
						// Surface Elasticsearch's reason rather than a transport dump.
						throw new Error(getErrorReason(err) || 'The request failed', { cause: err })
					}
				},
			}),
		])
	)
}
