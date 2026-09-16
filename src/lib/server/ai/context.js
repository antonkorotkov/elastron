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

// Drops a part's provider-specific metadata, such as the ids OpenAI uses to
// refer back to items it stored.
const withoutProviderOptions = part => {
	const copy = { ...part }
	delete copy.providerOptions
	return copy
}

/**
 * An earlier turn's assistant message as the model sees it: its reasoning
 * removed, and its remaining parts stripped of provider ids. Keeping an id
 * would make OpenAI refer back to the stored reply by reference, and OpenAI
 * rejects a reply referenced without its reasoning ("Item 'msg_…' of type
 * 'message' was provided without its required 'reasoning' item"). It also
 * stops working once OpenAI drops stored items. Without the ids, the reply
 * is sent as plain text.
 */
const asEarlierTurn = message => {
	if (message.role !== 'assistant' || typeof message.content === 'string') return message
	return {
		...message,
		content: message.content.filter(part => part.type !== 'reasoning').map(withoutProviderOptions),
	}
}

/**
 * Converts the windowed UI messages to model messages. Every turn before the
 * current one loses its tool calls, tool results, approvals, and reasoning,
 * keeping the assistant's text, which already summarizes what the tools
 * found. The current turn is kept whole, reasoning included: a reply that
 * continues after an approval must send the model's reasoning with the tool
 * call it belongs to, and an approval in flight must survive.
 */
export const buildModelMessages = async (messages, { tools } = {}) => {
	const modelMessages = await convertToModelMessages(windowMessages(messages), {
		tools,
		// Drops tool calls that never finished, such as an approval the user
		// ignored in an earlier turn, which providers reject as dangling.
		ignoreIncompleteToolCalls: true,
	})

	const lastUser = findLastIndex(modelMessages, message => message.role === 'user')
	const currentTurnStart = lastUser === -1 ? 0 : lastUser
	const currentTurnLength = modelMessages.length - currentTurnStart

	const earlierTurnsTrimmed = modelMessages.map((message, index) =>
		index < currentTurnStart ? asEarlierTurn(message) : message
	)

	return pruneMessages({
		messages: earlierTurnsTrimmed,
		toolCalls: `before-last-${currentTurnLength}-messages`,
		emptyMessages: 'remove',
	}).filter(message => typeof message.content === 'string' || message.content.length > 0)
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
