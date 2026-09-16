import { describe, it, expect, vi } from 'vitest'
import { createAssistantTools } from './index.js'
import { TUNNEL_NOT_OPEN } from '../../elastic.js'

const clients = vi.hoisted(() => ({ created: 0 }))

vi.mock('elasticsearch8', () => ({
	Client: class {
		constructor() {
			clients.created++
			this.transport = { request: vi.fn(async () => ({ acknowledged: true })) }
			this.close = vi.fn()
		}
	},
}))
vi.mock('elasticsearch9', () => ({ Client: class {} }))
vi.mock('../../tunnel.js', () => ({ tunnelManager: { getLocalPort: () => null } }))

// Through the real connection helper: a tunnel profile whose tunnel dropped
// must not send an approved write to the configured host, which for a
// tunnel profile is often the user's own localhost.
describe('assistant tools on a tunnel connection whose tunnel is down', () => {
	it('fails an approved delete without creating a client', async () => {
		const tools = createAssistantTools({
			connection: { host: 'http://localhost', port: '9200', useSshTunnel: true },
			windowId: 'win-1',
		})
		await expect(
			tools['delete-index'].execute({ index: 'logs' }, { toolCallId: 'c1', messages: [] })
		).rejects.toThrow(TUNNEL_NOT_OPEN)
		expect(clients.created).toBe(0)
	})
})
