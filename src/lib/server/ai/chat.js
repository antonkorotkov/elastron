import { json } from '@sveltejs/kit'
import {
	streamText,
	isStepCount,
	safeValidateUIMessages,
	toUIMessageStream,
	createUIMessageStreamResponse,
} from 'ai'
import { isProviderUsable } from '$lib/ai/providers.js'
import { createAssistantTools, toolApproval } from '$lib/server/ai/tools/index.js'
import { buildInstructions } from '$lib/server/ai/instructions.js'
import { buildModelMessages, buildCacheableInstructions } from '$lib/server/ai/context.js'
import { createProviderModel } from '$lib/server/ai/provider.js'
import { getToolApprovalSecret } from '$lib/server/ai/approvalSecret.js'
import { createRedactor, describeProviderError } from '$lib/server/ai/errors.js'

/** The most model calls in one reply, counting each round of tool calls. */
export const MAX_STEPS = 12

export const PROVIDER_NOT_CONFIGURED =
	'No AI provider is configured. Choose a provider and enter its API key and model in Settings, under AI Integration.'

/**
 * Streams one assistant reply. The renderer sends the conversation, the
 * connection and window the tools act on, the active provider's settings,
 * and the cluster's version and flavor.
 */
export const handleChatRequest = async request => {
	let body
	try {
		body = await request.json()
	} catch {
		return json({ error: 'Invalid JSON payload' }, { status: 400 })
	}

	const { messages, connection, windowId, provider: settings, cluster } = body ?? {}

	if (!isProviderUsable(settings)) {
		return json({ error: PROVIDER_NOT_CONFIGURED, code: 'provider-not-configured' }, { status: 400 })
	}
	if (!connection) {
		return json({ error: 'Connection details required' }, { status: 400 })
	}

	const tools = createAssistantTools({ connection, windowId })
	const validation = await safeValidateUIMessages({ messages, tools })
	if (!validation.success) {
		return json(
			{ error: 'The conversation could not be read. Clear the assistant history and try again.' },
			{ status: 400 }
		)
	}

	const redact = createRedactor(settings.apiKey)

	try {
		const result = streamText({
			model: createProviderModel(settings),
			tools,
			toolApproval,
			experimental_toolApprovalSecret: getToolApprovalSecret(),
			instructions: buildCacheableInstructions(buildInstructions(cluster), settings.provider),
			messages: await buildModelMessages(validation.data, { tools }),
			stopWhen: isStepCount(MAX_STEPS),
			abortSignal: request.signal,
			// The default handler logs the raw error, which can echo the key.
			onError: ({ error }) => console.error('Assistant error:', redact(describeProviderError(error))),
		})

		return createUIMessageStreamResponse({
			stream: toUIMessageStream({
				stream: result.stream,
				tools,
				// Replaces the SDK's generic masking with a readable, key-free message.
				onError: error => redact(describeProviderError(error)),
			}),
		})
	} catch (error) {
		return json({ error: redact(describeProviderError(error)) }, { status: 500 })
	}
}
