import { describe, it, expect, vi, beforeEach } from 'vitest'
import { simulateReadableStream } from 'ai'
import { MockLanguageModelV4 } from 'ai/test'
import { POST } from './+server.js'
import { PROVIDER_NOT_CONFIGURED, MAX_STEPS } from '$lib/server/ai/chat.js'

const holder = vi.hoisted(() => ({ model: null, settings: null }))

vi.mock('$lib/server/ai/provider.js', () => ({
	createProviderModel: settings => {
		holder.settings = settings
		return holder.model
	},
}))

const usage = {
	inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined },
	outputTokens: { total: 1, text: 1, reasoning: undefined },
}

const replying = (text, capture) =>
	new MockLanguageModelV4({
		doStream: async options => {
			capture?.(options)
			return {
				stream: simulateReadableStream({
					chunks: [
						{ type: 'text-start', id: 't' },
						{ type: 'text-delta', id: 't', delta: text },
						{ type: 'text-end', id: 't' },
						{ type: 'finish', finishReason: { unified: 'stop', raw: undefined }, usage },
					],
				}),
			}
		},
	})

const API_KEY = 'sk-test-secret-key-123456'
const openai = { provider: 'openai', apiKey: API_KEY, model: 'gpt-5.1' }
const userMessage = { id: 'u1', role: 'user', parts: [{ type: 'text', text: 'How many indices?' }] }

const post = body =>
	POST({
		request: new Request('http://localhost/api/ai/chat', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: typeof body === 'string' ? body : JSON.stringify(body),
		}),
	})

const baseBody = {
	messages: [userMessage],
	connection: { host: 'http://localhost', port: '9200' },
	windowId: 'win-1',
	provider: openai,
	cluster: { version: '9.1.0', flavor: 'default' },
}

describe('POST /api/ai/chat', () => {
	beforeEach(() => {
		holder.model = replying('There are 3 indices.')
		holder.settings = null
	})

	it('rejects a request with no provider configured', async () => {
		const response = await post({ ...baseBody, provider: null })
		expect(response.status).toBe(400)
		expect(await response.json()).toEqual({ error: PROVIDER_NOT_CONFIGURED, code: 'provider-not-configured' })
	})

	it.each([
		['no key', { ...openai, apiKey: '' }],
		['no model', { ...openai, model: ' ' }],
		['custom without base URL', { provider: 'custom', apiKey: 'k', model: 'llama3.1' }],
		['unknown provider', { provider: 'bogus', apiKey: 'k', model: 'm' }],
	])('rejects an unusable provider: %s', async (_label, provider) => {
		const response = await post({ ...baseBody, provider })
		expect(response.status).toBe(400)
		expect((await response.json()).code).toBe('provider-not-configured')
	})

	it('rejects invalid JSON, a missing connection, and malformed messages', async () => {
		expect((await post('{nope')).status).toBe(400)
		expect((await post({ ...baseBody, connection: undefined })).status).toBe(400)
		expect((await post({ ...baseBody, messages: [{ role: 'user' }] })).status).toBe(400)
	})

	it('streams the reply using the active provider settings', async () => {
		const response = await post(baseBody)
		expect(response.status).toBe(200)
		expect(await response.text()).toContain('There are 3 indices.')
		expect(holder.settings).toEqual(openai)
	})

	it('sends the cluster version and flavor to the provider', async () => {
		let prompt
		holder.model = replying('ok', options => (prompt = options.prompt))
		await (await post(baseBody)).text()
		expect(prompt[0].role).toBe('system')
		expect(prompt[0].content).toContain('Elasticsearch 9.1.0')
		expect(prompt[0].content).toContain('default')
		expect(JSON.stringify(prompt)).not.toContain('localhost')
	})

	it('marks the instructions cacheable for Anthropic', async () => {
		let prompt
		holder.model = replying('ok', options => (prompt = options.prompt))
		await (await post({ ...baseBody, provider: { provider: 'anthropic', apiKey: API_KEY, model: 'claude-opus-5' } })).text()
		expect(prompt[0].providerOptions).toEqual({ anthropic: { cacheControl: { type: 'ephemeral' } } })
	})

	it('reports a provider error without revealing the API key', async () => {
		const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
		holder.model = new MockLanguageModelV4({
			doStream: async () => {
				throw Object.assign(new Error(`Incorrect API key provided: ${API_KEY}`), { statusCode: 401 })
			},
		})
		const text = await (await post(baseBody)).text()
		expect(text).toContain('The provider rejected the API key.')
		expect(text).not.toContain(API_KEY)
		for (const call of consoleError.mock.calls) expect(call.join(' ')).not.toContain(API_KEY)
		consoleError.mockRestore()
	})

	it('limits a reply to fewer model calls than the SDK default', () => {
		expect(MAX_STEPS).toBeLessThan(20)
	})
})
