/**
 * The most messages sent per request. The server narrows further, to a
 * window starting at a user message.
 */
export const SEND_MESSAGES_LIMIT = 60

const lastUserIndex = messages => {
	for (let i = messages.length - 1; i >= 0; i--) {
		if (messages[i].role === 'user') return i
	}
	return -1
}

/**
 * What a chat request carries: the most recent messages, with tool calls,
 * tool results, reasoning, and provider metadata removed from every turn
 * before the current one, keeping only the assistant's text. The server drops those anyway, and
 * sending them made long conversations exceed the packaged server's request
 * size limit. The current turn is sent whole, so approvals and the results
 * the model is still working with arrive intact. The stored conversation and
 * what the drawer shows are not affected.
 */
export const prepareOutgoingMessages = (messages, limit = SEND_MESSAGES_LIMIT) => {
	const recent = messages.slice(-limit)
	const currentTurn = lastUserIndex(recent)
	return recent.flatMap((message, index) => {
		if (index >= currentTurn || message.role !== 'assistant') return [message]
		// Provider metadata goes too: it holds ids the provider would use to
		// refer back to stored items, which break once reasoning is removed.
		const parts = message.parts
			.filter(part => part.type === 'text')
			.map(part => {
				const copy = { ...part }
				delete copy.providerMetadata
				return copy
			})
		return parts.length ? [{ ...message, parts }] : []
	})
}
