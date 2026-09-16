import { describe, it, expect } from 'vitest'
import { safeValidateUIMessages } from 'ai'
import { prepareOutgoingMessages, SEND_MESSAGES_LIMIT } from './outgoing.js'

const LIMIT_BYTES = 512 * 1024
const bigOutput = () => ({ truncated: true, preview: 'x'.repeat(20000) })

const user = (id, text = 'q') => ({ id, role: 'user', parts: [{ type: 'text', text }] })
const toolTurn = (id, calls) => ({
	id,
	role: 'assistant',
	parts: [
		...Array.from({ length: calls }, (_, i) => ({
			type: 'tool-get-mapping',
			toolCallId: `${id}-${i}`,
			state: 'output-available',
			input: { index: 'logs' },
			output: bigOutput(),
		})),
		{ type: 'text', text: `Answer ${id}` },
	],
})

// Thirty turns, each reading three mappings at the 20k result cap: the kind
// of history that pushed chat requests past the packaged server's limit.
const heavyHistory = () => {
	const messages = []
	for (let turn = 0; turn < 30; turn++) {
		messages.push(user(`u${turn}`, `question ${turn}`))
		messages.push(toolTurn(`a${turn}`, 3))
	}
	return messages
}

const bytes = value => new TextEncoder().encode(JSON.stringify(value)).length

describe('prepareOutgoingMessages', () => {
	it('keeps a heavy history far below the server limit', () => {
		const messages = heavyHistory()
		expect(bytes(messages.slice(-SEND_MESSAGES_LIMIT))).toBeGreaterThan(LIMIT_BYTES)
		expect(bytes(prepareOutgoingMessages(messages))).toBeLessThan(LIMIT_BYTES / 4)
	})

	it('keeps earlier turns as text and the current turn whole', () => {
		const messages = [user('u1'), toolTurn('a1', 2), user('u2'), toolTurn('a2', 2)]
		const prepared = prepareOutgoingMessages(messages)
		expect(prepared[1].parts).toEqual([{ type: 'text', text: 'Answer a1' }])
		expect(prepared[3]).toBe(messages[3])
	})

	it('strips provider ids from earlier replies but not from the current turn', () => {
		const withIds = (id, n) => ({
			id,
			role: 'assistant',
			parts: [
				{ type: 'reasoning', text: '', providerMetadata: { openai: { itemId: `rs_${n}` } } },
				{ type: 'text', text: `reply ${n}`, providerMetadata: { openai: { itemId: `msg_${n}` } } },
			],
		})
		const current = withIds('a2', 2)
		const prepared = prepareOutgoingMessages([user('u1'), withIds('a1', 1), user('u2'), current])
		expect(prepared[1].parts).toEqual([{ type: 'text', text: 'reply 1' }])
		expect(prepared[3]).toBe(current)
	})

	it('keeps an approval in flight', () => {
		const pending = {
			id: 'a2',
			role: 'assistant',
			parts: [{ type: 'tool-delete-index', toolCallId: 'c1', state: 'approval-responded', input: { index: 'old' }, approval: { id: 'ap1', approved: true } }],
		}
		const prepared = prepareOutgoingMessages([user('u1'), toolTurn('a1', 1), user('u2'), pending])
		expect(prepared.at(-1)).toBe(pending)
	})

	it('drops an earlier assistant message left with nothing but tool traffic', () => {
		const toolsOnly = { id: 'a1', role: 'assistant', parts: [{ type: 'tool-list-indices', toolCallId: 'c', state: 'output-available', input: {}, output: { rows: [] } }] }
		expect(prepareOutgoingMessages([user('u1'), toolsOnly, user('u2')]).map(m => m.id)).toEqual(['u1', 'u2'])
	})

	it('sends at most the message limit', () => {
		expect(prepareOutgoingMessages(heavyHistory()).length).toBeLessThanOrEqual(SEND_MESSAGES_LIMIT)
	})

	it('produces messages the chat route accepts', async () => {
		const result = await safeValidateUIMessages({ messages: prepareOutgoingMessages(heavyHistory()) })
		expect(result.success).toBe(true)
	})

	it('does not change the messages it is given', () => {
		const messages = heavyHistory()
		const before = JSON.stringify(messages)
		prepareOutgoingMessages(messages)
		expect(JSON.stringify(messages)).toBe(before)
	})
})
