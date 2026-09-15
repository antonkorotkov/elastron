import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createStoreon } from 'storeon'
import { getStorage, setStorage } from '../utils/storage.js'
import {
	assistant,
	endpointOf,
	historyKey,
	trimMessages,
	MAX_STORED_MESSAGES,
} from './assistant'

vi.mock('../utils/storage.js', () => ({
	getStorage: vi.fn(),
	setStorage: vi.fn(),
}))

// A stand-in connection module: the real one talks to the cluster.
const connection = store => {
	store.on('@init', () => ({ connection: {} }))
	store.on('connection/update', (state, data) => ({ connection: { ...state.connection, ...data } }))
}

const user = (id, text = 'q') => ({ id, role: 'user', parts: [{ type: 'text', text }] })
const reply = (id, text = 'a') => ({ id, role: 'assistant', parts: [{ type: 'text', text }] })

const flush = () => new Promise(resolve => setTimeout(resolve, 0))

describe('assistant store module', () => {
	let store
	let saved

	beforeEach(() => {
		saved = new Map()
		setStorage.mockReset().mockImplementation((key, value) => saved.set(key, value))
		getStorage.mockReset().mockImplementation(async (key, fallback) => (saved.has(key) ? saved.get(key) : fallback))
		store = createStoreon([connection, assistant])
	})

	const state = () => store.get().assistant

	const connectTo = async conn => {
		store.dispatch('connection/update', conn)
		store.dispatch('connected', {})
		await flush()
	}

	it('opens, closes, and toggles the drawer', () => {
		expect(state().open).toBe(false)
		store.dispatch('assistant/open')
		expect(state().open).toBe(true)
		store.dispatch('assistant/close')
		expect(state().open).toBe(false)
		store.dispatch('assistant/toggle')
		expect(state().open).toBe(true)
	})

	it('appends messages and persists them for the endpoint', async () => {
		await connectTo({ host: 'http://es-a', port: '9200' })
		store.dispatch('assistant/append', user('u1'))
		store.dispatch('assistant/append', reply('a1'))
		expect(state().messages.map(m => m.id)).toEqual(['u1', 'a1'])
		expect(saved.get(historyKey('http://es-a|9200|'))).toEqual(state().messages)
	})

	it('restores each endpoint conversation when switching', async () => {
		await connectTo({ host: 'http://es-a', port: '9200' })
		store.dispatch('assistant/setMessages', [user('a-q'), reply('a-a')])

		await connectTo({ host: 'http://es-b', port: '9200' })
		expect(state().messages).toEqual([])
		store.dispatch('assistant/setMessages', [user('b-q')])

		await connectTo({ host: 'http://es-a', port: '9200' })
		expect(state().messages.map(m => m.id)).toEqual(['a-q', 'a-a'])
	})

	it('shares one conversation between profiles for the same endpoint', async () => {
		await connectTo({ name: 'Prod', color: '#db2828', host: 'https://es.example.com/', port: '9243', useAuth: true, user: 'elastic', password: 'one' })
		store.dispatch('assistant/setMessages', [user('shared')])

		await connectTo({ host: 'http://other', port: '9200' })
		await connectTo({ name: 'Prod copy', color: '', host: 'HTTPS://ES.EXAMPLE.COM', port: '9243', useAuth: true, user: 'elastic', password: 'two' })
		expect(state().messages.map(m => m.id)).toEqual(['shared'])
	})

	it('switches history after a failed attempt to another endpoint', async () => {
		await connectTo({ host: 'http://es-a', port: '9200' })
		store.dispatch('assistant/setMessages', [user('a')])
		store.dispatch('connection/update', { host: 'http://es-b' })
		store.dispatch('disconnected')
		await flush()
		expect(state().endpoint).toBe('http://es-b|9200|')
		expect(state().messages).toEqual([])
	})

	it('switches history when the connection changes without a connect event', async () => {
		await connectTo({ host: 'http://es-a', port: '9200' })
		store.dispatch('assistant/setMessages', [user('a')])
		// Quick Connect updates the connection first; a failed SSH tunnel then
		// returns without dispatching connected or disconnected.
		store.dispatch('connection/update', { host: 'http://es-b', port: '9200' })
		await flush()
		expect(state().endpoint).toBe('http://es-b|9200|')
		expect(state().messages).toEqual([])
	})

	it('keeps separate conversations for the same host behind different SSH bastions', async () => {
		const tunnel = sshHost => ({ host: 'http://localhost', port: '9200', useSshTunnel: true, ssh: { host: sshHost, port: '22', username: 'deploy' } })
		await connectTo(tunnel('bastion-prod'))
		store.dispatch('assistant/setMessages', [user('prod-question')])

		await connectTo(tunnel('bastion-stg'))
		expect(state().messages).toEqual([])

		await connectTo(tunnel('bastion-prod'))
		expect(state().messages.map(m => m.id)).toEqual(['prod-question'])
	})

	it('keeps the in-memory conversation when reconnecting to the same endpoint', async () => {
		await connectTo({ host: 'http://es-a', port: '9200' })
		store.dispatch('assistant/append', user('u1'))
		getStorage.mockClear()
		await connectTo({ host: 'http://es-a', port: '9200' })
		expect(getStorage).not.toHaveBeenCalled()
		expect(state().messages.map(m => m.id)).toEqual(['u1'])
	})

	it('drops a load for an endpoint the window has already left', async () => {
		await connectTo({ host: 'http://es-b', port: '9200' })
		store.dispatch('assistant/loaded', { endpoint: 'http://es-a|9200|', messages: [user('stale')] })
		expect(state().endpoint).toBe('http://es-b|9200|')
		expect(state().messages).toEqual([])
	})

	it('never stores more than the cap', async () => {
		await connectTo({ host: 'http://es-a', port: '9200' })
		for (let i = 0; i < MAX_STORED_MESSAGES + 25; i++) {
			store.dispatch('assistant/append', i % 2 ? reply(`m${i}`) : user(`m${i}`))
			expect(saved.get(historyKey('http://es-a|9200|')).length).toBeLessThanOrEqual(MAX_STORED_MESSAGES)
		}
		const stored = saved.get(historyKey('http://es-a|9200|'))
		expect(stored.at(-1).id).toBe(`m${MAX_STORED_MESSAGES + 24}`)
		expect(stored[0].role).toBe('user')
	})

	it('clears the stored and in-memory conversation', async () => {
		await connectTo({ host: 'http://es-a', port: '9200' })
		store.dispatch('assistant/setMessages', [user('u1'), reply('a1')])
		store.dispatch('assistant/clear')
		expect(state().messages).toEqual([])
		expect(saved.get(historyKey('http://es-a|9200|'))).toEqual([])
	})
})

describe('endpoint helpers', () => {
	it('ignores the user when auth is off', () => {
		expect(endpointOf({ host: 'h', port: '1', useAuth: false, user: 'x' })).toBe('h|1|')
		expect(endpointOf({ host: 'h', port: '1', useAuth: true, user: 'x' })).toBe('h|1|x')
		expect(endpointOf({})).toBe(null)
	})

	it('includes the SSH tunnel only when one is used', () => {
		const ssh = { host: 'Bastion.example.com', port: '2222', username: 'deploy' }
		expect(endpointOf({ host: 'http://localhost', port: '9200', useSshTunnel: true, ssh })).toBe('http://localhost|9200||ssh:deploy@bastion.example.com:2222')
		expect(endpointOf({ host: 'http://localhost', port: '9200', useSshTunnel: false, ssh })).toBe('http://localhost|9200|')
	})

	it('builds storage keys without dots', () => {
		const key = historyKey('https://es.prod.example.com|9243|elastic')
		expect(key).toMatch(/^assistantHistory_[A-Za-z0-9_-]+$/)
		expect(key).not.toBe(historyKey('https://es.prod.example.com|9243|other'))
	})

	it('trims from the oldest end to a user message', () => {
		const messages = [user('1'), reply('2'), user('3'), reply('4'), user('5')]
		expect(trimMessages(messages, 4).map(m => m.id)).toEqual(['3', '4', '5'])
		expect(trimMessages(null)).toEqual([])
	})
})
