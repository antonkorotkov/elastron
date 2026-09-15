import { Chat } from '@ai-sdk/svelte'
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithApprovalResponses } from 'ai'

/**
 * The most messages sent per request. The server narrows further, to a
 * window starting at a user message, and prunes old tool results; this only
 * keeps a long stored conversation from crossing the wire every turn.
 */
export const SEND_MESSAGES_LIMIT = 60

/**
 * Creates the chat for one endpoint's conversation.
 *
 * - `getRequestContext` is read at send time, so the connection, provider,
 *   and cluster info are always current.
 * - `onSettled` receives the messages whenever a reply ends, fails, or is
 *   stopped, which is when the conversation is persisted.
 * - Answering the last approval sends the conversation back automatically,
 *   so an approved write runs without another message from the user.
 * - `onReply` is called when a reply finishes normally, not when it fails,
 *   is stopped, or the connection drops.
 */
export const createAssistantChat = ({ messages = [], getRequestContext, onSettled, onReply, fetch }) => {
	const chat = new Chat({
		messages,
		transport: new DefaultChatTransport({
			api: '/api/ai/chat',
			fetch,
			prepareSendMessagesRequest: ({ id, messages: all }) => ({
				body: { id, messages: all.slice(-SEND_MESSAGES_LIMIT), ...getRequestContext() },
			}),
		}),
		sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
		onFinish: ({ isAbort, isDisconnect, isError }) => {
			onSettled(chat.messages)
			if (!isAbort && !isDisconnect && !isError) onReply?.()
		},
		onError: () => onSettled(chat.messages),
	})
	return chat
}
