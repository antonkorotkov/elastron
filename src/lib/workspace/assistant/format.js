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

// Tool states meaning a reply already did something: a tool ran (or failed
// or was declined), or the user answered an approval.
const PROGRESS_STATES = new Set(['output-available', 'output-error', 'output-denied', 'approval-responded'])

/**
 * Whether the last reply made progress before it failed. Retrying such a
 * reply must continue it rather than regenerate it: regenerating deletes the
 * whole reply, including writes the user approved and that already ran, and
 * the model may then ask to make them again.
 */
export const replyMadeProgress = messages => {
	const last = messages?.at(-1)
	return (
		last?.role === 'assistant' &&
		last.parts.some(part => isToolPart(part) && PROGRESS_STATES.has(part.state))
	)
}

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
