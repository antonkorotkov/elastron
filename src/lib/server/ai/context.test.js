import { describe, it, expect } from 'vitest'
import { createOpenAI } from '@ai-sdk/openai'
import {
	windowMessages,
	buildModelMessages,
	buildCacheableInstructions,
	CONTEXT_WINDOW_MESSAGES,
} from './context'

const user = (id, text) => ({ id, role: 'user', parts: [{ type: 'text', text }] })
const reply = (id, text) => ({ id, role: 'assistant', parts: [{ type: 'text', text }] })
const searchTurn = (id, callId, hits) => ({
	id,
	role: 'assistant',
	parts: [
		{
			type: 'tool-run-search-body',
			toolCallId: callId,
			state: 'output-available',
			input: { index: 'logs', query: { match_all: {} } },
			output: { hits },
		},
		{ type: 'text', text: `Found ${hits.length} logs` },
	],
})

const allParts = modelMessages =>
	modelMessages.flatMap(message => (typeof message.content === 'string' ? [] : message.content))

describe('windowMessages', () => {
	it('returns short conversations unchanged', () => {
		const messages = [user('u1', 'hi'), reply('a1', 'hello')]
		expect(windowMessages(messages)).toBe(messages)
	})

	it('keeps at most the bound, starting at a user message', () => {
		const messages = []
		for (let i = 0; i < 40; i++) messages.push(i % 2 ? reply(`m${i}`, 'a') : user(`m${i}`, 'q'))
		const windowed = windowMessages(messages, 9)
		expect(windowed.length).toBeLessThanOrEqual(9)
		expect(windowed[0].role).toBe('user')
		expect(windowed.at(-1)).toBe(messages.at(-1))
	})

	it('always keeps the latest user message', () => {
		const messages = [user('u1', 'q'), reply('a1', 'a'), user('u2', 'q2'), reply('a2', 'x'), reply('a3', 'y'), reply('a4', 'z')]
		const windowed = windowMessages(messages, 2)
		expect(windowed[0].id).toBe('u2')
	})

	it('defaults to the configured bound', () => {
		const messages = []
		for (let i = 0; i < CONTEXT_WINDOW_MESSAGES * 2; i++) messages.push(i % 2 ? reply(`m${i}`, 'a') : user(`m${i}`, 'q'))
		expect(windowMessages(messages).length).toBeLessThanOrEqual(CONTEXT_WINDOW_MESSAGES)
	})
})

describe('buildModelMessages', () => {
	it('drops tool results from earlier turns but keeps the replies', async () => {
		const messages = [
			user('u1', 'show logs'),
			searchTurn('a1', 'call-old', [{ _id: 'old-hit' }]),
			user('u2', 'and errors?'),
		]
		const model = await buildModelMessages(messages)
		const parts = allParts(model)

		expect(parts.some(part => part.type === 'tool-call' || part.type === 'tool-result')).toBe(false)
		expect(JSON.stringify(model)).not.toContain('old-hit')
		expect(JSON.stringify(model)).toContain('Found 1 logs')
	})

	it('keeps tool traffic from the current turn', async () => {
		const messages = [user('u1', 'show logs'), searchTurn('a1', 'call-now', [{ _id: 'fresh-hit' }])]
		const model = await buildModelMessages(messages)
		const parts = allParts(model)

		expect(parts.some(part => part.type === 'tool-call' && part.toolCallId === 'call-now')).toBe(true)
		expect(parts.some(part => part.type === 'tool-result' && part.toolCallId === 'call-now')).toBe(true)
	})

	it('never opens the window on an orphaned tool result', async () => {
		const messages = []
		for (let i = 0; i < 20; i++) {
			messages.push(user(`u${i}`, `q${i}`))
			messages.push(searchTurn(`a${i}`, `call-${i}`, [{ _id: `hit-${i}` }]))
		}
		const model = await buildModelMessages(messages)
		const callIds = new Set(allParts(model).filter(p => p.type === 'tool-call').map(p => p.toolCallId))
		const resultIds = allParts(model).filter(p => p.type === 'tool-result').map(p => p.toolCallId)

		expect(model[0].role).toBe('user')
		for (const id of resultIds) expect(callIds.has(id)).toBe(true)
	})

	it('keeps an approval the user just answered', async () => {
		const messages = [
			user('u1', 'delete logs-old'),
			{
				id: 'a1',
				role: 'assistant',
				parts: [
					{
						type: 'tool-delete-index',
						toolCallId: 'call-del',
						state: 'approval-responded',
						input: { index: 'logs-old' },
						approval: { id: 'approval-1', approved: true },
					},
				],
			},
		]
		const parts = allParts(await buildModelMessages(messages))

		expect(parts.some(part => part.type === 'tool-call' && part.toolCallId === 'call-del')).toBe(true)
		expect(parts.some(part => part.type === 'tool-approval-response' && part.approvalId === 'approval-1')).toBe(true)
	})

	it('drops an approval the user ignored in an earlier turn', async () => {
		const messages = [
			user('u1', 'delete logs-old'),
			{
				id: 'a1',
				role: 'assistant',
				parts: [
					{
						type: 'tool-delete-index',
						toolCallId: 'call-ignored',
						state: 'approval-requested',
						input: { index: 'logs-old' },
						approval: { id: 'approval-ignored' },
					},
				],
			},
			user('u2', 'never mind, count docs'),
		]
		expect(JSON.stringify(await buildModelMessages(messages))).not.toContain('call-ignored')
	})

	it('does not mutate the messages it is given', async () => {
		const messages = [user('u1', 'show logs'), searchTurn('a1', 'call-1', [{ _id: 'x' }]), user('u2', 'more')]
		const before = JSON.stringify(messages)
		await buildModelMessages(messages)
		expect(JSON.stringify(messages)).toBe(before)
	})
})

describe('buildCacheableInstructions', () => {
	it('adds a cache breakpoint for Anthropic', () => {
		expect(buildCacheableInstructions('rules', 'anthropic')).toEqual({
			role: 'system',
			content: 'rules',
			providerOptions: { anthropic: { cacheControl: { type: 'ephemeral' } } },
		})
	})

	it('passes plain text for other providers', () => {
		for (const provider of ['openai', 'google', 'custom']) {
			expect(buildCacheableInstructions('rules', provider)).toBe('rules')
		}
	})
})

// A reply from an OpenAI reasoning model as the chat stores it: a reasoning
// item and a message item, each carrying the id OpenAI stored it under.
const reasoningReply = (id, n, text) => ({
	id,
	role: 'assistant',
	parts: [
		{ type: 'reasoning', text: '', providerMetadata: { openai: { itemId: `rs_${n}`, reasoningEncryptedContent: null } } },
		{ type: 'text', text, providerMetadata: { openai: { itemId: `msg_${n}` } } },
	],
})

// What the real OpenAI provider would send for these messages.
const openaiInput = async messages => {
	let body
	const model = createOpenAI({
		apiKey: 'test',
		fetch: async (_url, init) => {
			body = JSON.parse(init.body)
			return new Response('data: [DONE]\n\n', { headers: { 'content-type': 'text/event-stream' } })
		},
	})('gpt-5.1')
	const { stream } = await model.doStream({ prompt: await buildModelMessages(messages) })
	const reader = stream.getReader()
	await reader.read()
	await reader.cancel().catch(() => {})
	return body.input
}

describe('history sent to OpenAI reasoning models', () => {
	it('sends an earlier reply as plain text, never as a reference missing its reasoning', async () => {
		const input = await openaiInput([
			user('u1', 'how many indices?'),
			reasoningReply('a1', 1, 'There are 3.'),
			user('u2', 'and aliases?'),
		])
		expect(input.some(item => item.type === 'item_reference')).toBe(false)
		expect(JSON.stringify(input)).not.toMatch(/msg_1|rs_1/)
		expect(input).toContainEqual({ role: 'assistant', content: [{ type: 'output_text', text: 'There are 3.' }] })
	})

	it('keeps the current turn reasoning with its tool call when continuing after an approval', async () => {
		const input = await openaiInput([
			user('u1', 'how many indices?'),
			reasoningReply('a1', 1, 'There are 3.'),
			user('u2', 'delete tmp'),
			{
				id: 'a2',
				role: 'assistant',
				parts: [
					{ type: 'reasoning', text: '', providerMetadata: { openai: { itemId: 'rs_2', reasoningEncryptedContent: null } } },
					{
						type: 'tool-delete-index',
						toolCallId: 'call_2',
						state: 'approval-responded',
						input: { index: 'tmp' },
						callProviderMetadata: { openai: { itemId: 'fc_2' } },
						approval: { id: 'ap_2', approved: true },
					},
				],
			},
		])
		const ids = input.map(item => item.id).filter(Boolean)
		expect(ids).toContain('rs_2')
		const call = ids.indexOf('fc_2') === -1 ? ids.length : ids.indexOf('fc_2')
		expect(ids.indexOf('rs_2')).toBeLessThan(call)
	})
})

describe('reasoning across turns', () => {
	it('drops reasoning from earlier turns and keeps it in the current one', async () => {
		const model = await buildModelMessages([
			user('u1', 'q1'),
			reasoningReply('a1', 1, 'first'),
			user('u2', 'q2'),
			reasoningReply('a2', 2, 'second'),
		])
		const reasoningOf = text =>
			model.find(m => m.role === 'assistant' && m.content.some(p => p.type === 'text' && p.text === text)).content.filter(p => p.type === 'reasoning')
		expect(reasoningOf('first')).toEqual([])
		expect(reasoningOf('second')).toHaveLength(1)
	})

	it('strips provider ids from earlier replies only', async () => {
		const model = await buildModelMessages([
			user('u1', 'q1'),
			reasoningReply('a1', 1, 'first'),
			user('u2', 'q2'),
			reasoningReply('a2', 2, 'second'),
		])
		const textPart = text => model.flatMap(m => (typeof m.content === 'string' ? [] : m.content)).find(p => p.text === text)
		expect(textPart('first').providerOptions).toBeUndefined()
		expect(textPart('second').providerOptions).toEqual({ openai: { itemId: 'msg_2' } })
	})
})
