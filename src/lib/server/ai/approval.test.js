import { describe, it, expect, vi, beforeEach } from 'vitest'
import { streamText, simulateReadableStream } from 'ai'
import { MockLanguageModelV4 } from 'ai/test'
import { createAssistantTools, toolApproval } from './tools/index.js'
import { getToolApprovalSecret } from './approvalSecret.js'

const es = vi.hoisted(() => ({ request: null }))

vi.mock('../elastic.js', async importOriginal => ({
	...(await importOriginal()),
	withElasticClient: vi.fn(async (_connection, _windowId, fn) =>
		fn({ transport: { request: es.request } })
	),
}))

const usage = {
	inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined },
	outputTokens: { total: 1, text: 1, reasoning: undefined },
}

const modelCalling = (toolName, input) =>
	new MockLanguageModelV4({
		doStream: async () => ({
			stream: simulateReadableStream({
				chunks: [
					{ type: 'tool-call', toolCallId: 'call-1', toolName, input: JSON.stringify(input) },
					{ type: 'finish', finishReason: { unified: 'tool-calls', raw: undefined }, usage },
				],
			}),
		}),
	})

const modelReplying = text =>
	new MockLanguageModelV4({
		doStream: async () => ({
			stream: simulateReadableStream({
				chunks: [
					{ type: 'text-start', id: 't' },
					{ type: 'text-delta', id: 't', delta: text },
					{ type: 'text-end', id: 't' },
					{ type: 'finish', finishReason: { unified: 'stop', raw: undefined }, usage },
				],
			}),
		}),
	})

const run = async (model, messages) => {
	const result = streamText({
		model,
		messages,
		tools: createAssistantTools({ connection: { host: 'localhost', port: '9200' }, windowId: 'w' }),
		toolApproval,
		experimental_toolApprovalSecret: getToolApprovalSecret(),
	})
	const parts = []
	try {
		for await (const part of result.stream) parts.push(part)
	} catch (error) {
		parts.push({ type: 'thrown', error })
	}
	const response = await result.response.catch(() => ({ messages: [] }))
	return { parts, messages: response.messages }
}

const ask = { role: 'user', content: 'delete the logs index' }

const requestApproval = async () => {
	const first = await run(modelCalling('delete-index', { index: 'logs' }), [ask])
	const request = first.parts.find(part => part.type === 'tool-approval-request')
	return { first, request }
}

const answer = (request, approved) => ({
	role: 'tool',
	content: [{ type: 'tool-approval-response', approvalId: request.approvalId, approved }],
})

describe('tool approval through streamText', () => {
	beforeEach(() => {
		es.request = vi.fn(async () => ({ acknowledged: true }))
	})

	it('pauses a write tool for approval without touching the cluster', async () => {
		const { request } = await requestApproval()
		expect(request.toolCall.toolName).toBe('delete-index')
		expect(request.toolCall.input).toEqual({ index: 'logs' })
		expect(request.signature).toBeTruthy()
		expect(es.request).not.toHaveBeenCalled()
	})

	it('runs the write once the user approves', async () => {
		const { first, request } = await requestApproval()
		await run(modelReplying('Deleted.'), [ask, ...first.messages, answer(request, true)])
		expect(es.request).toHaveBeenCalledWith({ method: 'DELETE', path: '/logs' })
	})

	it('does not run the write when the user declines, and tells the model', async () => {
		const { first, request } = await requestApproval()
		const second = await run(modelReplying('Understood.'), [ask, ...first.messages, answer(request, false)])
		expect(es.request).not.toHaveBeenCalled()
		expect(JSON.stringify(second.parts)).toMatch(/denied/i)
	})

	it('rejects an approval whose tool input was altered after signing', async () => {
		const { first, request } = await requestApproval()
		const tampered = JSON.parse(JSON.stringify(first.messages))
		tampered[0].content.find(part => part.type === 'tool-call').input = { index: 'production' }
		await run(modelReplying('Done.'), [ask, ...tampered, answer(request, true)])
		expect(es.request).not.toHaveBeenCalled()
	})

	it('rejects an approval with no signature', async () => {
		const { first, request } = await requestApproval()
		const unsigned = JSON.parse(JSON.stringify(first.messages))
		delete unsigned[0].content.find(part => part.type === 'tool-approval-request').signature
		await run(modelReplying('Done.'), [ask, ...unsigned, answer(request, true)])
		expect(es.request).not.toHaveBeenCalled()
	})

	it('runs a read tool without asking', async () => {
		es.request = vi.fn(async () => ({ status: 'green' }))
		const { parts } = await run(modelCalling('cluster-health', {}), [{ role: 'user', content: 'health?' }])
		expect(parts.some(part => part.type === 'tool-approval-request')).toBe(false)
		expect(es.request).toHaveBeenCalledWith({ method: 'GET', path: '/_cluster/health' })
	})

	it('runs page 1 of the index list without asking', async () => {
		es.request = vi.fn(async () => [])
		const { parts } = await run(modelCalling('list-indices', {}), [{ role: 'user', content: 'indices?' }])
		expect(parts.some(part => part.type === 'tool-approval-request')).toBe(false)
		expect(es.request).toHaveBeenCalledTimes(1)
	})

	it('pauses page 2 of the index list and runs it once approved', async () => {
		es.request = vi.fn(async () => [])
		const listAsk = { role: 'user', content: 'show the next page' }
		const first = await run(modelCalling('list-indices', { page: 2 }), [listAsk])
		const request = first.parts.find(part => part.type === 'tool-approval-request')
		expect(request.toolCall.input).toEqual({ page: 2 })
		expect(es.request).not.toHaveBeenCalled()

		await run(modelReplying('Here is page 2.'), [listAsk, ...first.messages, answer(request, true)])
		expect(es.request).toHaveBeenCalledTimes(1)
	})

	it('pauses the generic request tool even for a GET', async () => {
		const { parts } = await run(modelCalling('run-es-request', { method: 'GET', path: '/_cat/nodes' }), [{ role: 'user', content: 'nodes' }])
		expect(parts.some(part => part.type === 'tool-approval-request')).toBe(true)
		expect(es.request).not.toHaveBeenCalled()
	})
})

describe('getToolApprovalSecret', () => {
	it('returns one stable, high-entropy secret per process', () => {
		const secret = getToolApprovalSecret()
		expect(secret).toBe(getToolApprovalSecret())
		expect(secret.length).toBeGreaterThanOrEqual(43)
	})
})
