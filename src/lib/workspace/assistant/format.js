import { TOOL_POLICY } from '../../ai/catalog.js'

/** The tool name inside a tool UI part, such as 'delete-index'. */
export const toolNameOf = part =>
	typeof part?.type === 'string' && part.type.startsWith('tool-') ? part.type.slice(5) : null

export const isToolPart = part => Boolean(toolNameOf(part) && TOOL_POLICY[toolNameOf(part)])

/**
 * Whether a tool failed because the model sent input the tool's schema
 * rejected. That error goes back to the model, which usually fixes it and
 * retries, so it isn't a failure the user needs to act on.
 */
export const isInvalidInputError = part =>
	part?.state === 'output-error' &&
	((part.input === undefined && part.rawInput !== undefined) ||
		/Invalid input for tool|InvalidToolInputError/.test(part.errorText ?? ''))

/** 'delete-index' becomes 'Delete index'. */
export const toolLabel = name => {
	const words = String(name ?? '').split('-').join(' ')
	return words.charAt(0).toUpperCase() + words.slice(1)
}

export const prettyJson = value => JSON.stringify(value, null, 2)

/**
 * A readable message from a chat error. Errors from a JSON response carry
 * the server's `error` field inside the message text.
 */
export const errorMessageOf = error => {
	const message = error?.message ?? String(error ?? '')
	try {
		const parsed = JSON.parse(message)
		if (parsed && typeof parsed.error === 'string') return parsed.error
	} catch {
		// Not JSON; use the message as it is.
	}
	return message || 'Something went wrong.'
}
