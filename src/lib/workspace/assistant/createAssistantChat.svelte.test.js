// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { createAssistantChat, CONNECTION_CHANGED } from './createAssistantChat.js'

const clusterA = { host: 'http://es-a', port: '9200' }
const clusterB = { host: 'http://es-b', port: '9200' }

describe('createAssistantChat', () => {
	it('refuses to send when the connection now reaches another cluster', async () => {
		const fetch = vi.fn()
		const onSettled = vi.fn()
		const chat = createAssistantChat({
			endpoint: 'http://es-a|9200|',
			getRequestContext: () => ({ connection: clusterB, windowId: 'w', provider: {}, cluster: {} }),
			onSettled,
			fetch,
		})

		await chat.sendMessage({ text: 'wipe orders' })

		expect(fetch).not.toHaveBeenCalled()
		expect(chat.error.message).toBe(CONNECTION_CHANGED)
	})

	it('sends when the connection still reaches its cluster', async () => {
		const fetch = vi.fn(async () => new Response('data: [DONE]\n\n', { headers: { 'content-type': 'text/event-stream' } }))
		const chat = createAssistantChat({
			endpoint: 'http://es-a|9200|',
			getRequestContext: () => ({ connection: clusterA, windowId: 'w', provider: {}, cluster: {} }),
			onSettled: vi.fn(),
			fetch,
		})

		await chat.sendMessage({ text: 'hello' })

		expect(fetch).toHaveBeenCalledTimes(1)
		expect(JSON.parse(fetch.mock.calls[0][1].body).connection).toEqual(clusterA)
	})
})
