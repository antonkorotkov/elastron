import { Chat } from '@ai-sdk/svelte'
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithApprovalResponses } from 'ai'
import { endpointOf } from '../../utils/endpoint.js'
import { prepareOutgoingMessages } from './outgoing.js'

export { SEND_MESSAGES_LIMIT } from './outgoing.js'

export const CONNECTION_CHANGED =
	'The connection changed, so nothing was sent. The conversation for the current cluster is loaded now; send your message again there.'

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
 * - `endpoint` is the cluster this conversation belongs to. A request whose
 *   connection now reaches a different cluster is refused before it is sent,
 *   including the automatic send after an approval.
 */
export const createAssistantChat = ({ endpoint, messages = [], getRequestContext, onSettled, onReply, fetch }) => {
	const chat = new Chat({
		messages,
		transport: new DefaultChatTransport({
			api: '/api/ai/chat',
			fetch,
			prepareSendMessagesRequest: ({ id, messages: all }) => {
				const context = getRequestContext()
				if (endpointOf(context.connection) !== endpoint) throw new Error(CONNECTION_CHANGED)
				return { body: { id, messages: prepareOutgoingMessages(all), ...context } }
			},
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
