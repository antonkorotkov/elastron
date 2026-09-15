import { convertToModelMessages, pruneMessages } from 'ai'

/**
 * The most recent UI messages sent to the model per request. The stored
 * conversation keeps more; this bounds cost and context size per turn.
 */
export const CONTEXT_WINDOW_MESSAGES = 30

const findLastIndex = (items, predicate) => {
	for (let i = items.length - 1; i >= 0; i--) {
		if (predicate(items[i])) return i
	}
	return -1
}

/**
 * Keeps the most recent `max` UI messages, moving the start forward to a user
 * message so the window never opens partway through an assistant turn. The
 * latest user message is always kept, however long its turn is.
 */
export const windowMessages = (messages, max = CONTEXT_WINDOW_MESSAGES) => {
	if (messages.length <= max) return messages

	const lastUser = findLastIndex(messages, message => message.role === 'user')
	if (lastUser === -1) return messages.slice(-max)

	let start = messages.length - max
	while (start < lastUser && messages[start].role !== 'user') start++
	return messages.slice(Math.min(start, lastUser))
}

/**
 * Converts the windowed UI messages to model messages and drops tool calls,
 * tool results, and approvals from every turn before the current one, plus
 * reasoning before the last message. The assistant's text replies stay; they
 * already summarize what the tools found. The current turn is never pruned,
 * so an approval in flight survives.
 */
export const buildModelMessages = async (messages, { tools } = {}) => {
	const modelMessages = await convertToModelMessages(windowMessages(messages), {
		tools,
		// Drops tool calls that never finished, such as an approval the user
		// ignored in an earlier turn, which providers reject as dangling.
		ignoreIncompleteToolCalls: true,
	})

	const lastUser = findLastIndex(modelMessages, message => message.role === 'user')
	const currentTurnLength = lastUser === -1 ? modelMessages.length : modelMessages.length - lastUser

	return pruneMessages({
		messages: modelMessages,
		reasoning: 'before-last-message',
		toolCalls: `before-last-${currentTurnLength}-messages`,
		emptyMessages: 'remove',
	})
}

/**
 * Wraps the system instructions for the provider. For Anthropic the system
 * message carries a cache breakpoint; tools precede it in Anthropic's prompt
 * order, so the tool definitions are cached along with it. OpenAI and Gemini
 * cache repeated prefixes on their own.
 */
export const buildCacheableInstructions = (text, provider) =>
	provider === 'anthropic'
		? {
				role: 'system',
				content: text,
				providerOptions: { anthropic: { cacheControl: { type: 'ephemeral' } } },
			}
		: text
