import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createStoreon } from 'storeon'
import { mappings, isFetchableIndex } from './mappings'

// Hoisted so the mock factory, which `vi.mock` lifts above these imports, is
// not closing over a binding that is still in its temporal dead zone.
const { getIndex } = vi.hoisted(() => ({ getIndex: vi.fn() }))

vi.mock('../../api/elasticsearch', () => ({
	default: class API {
		getIndex(index) {
			return getIndex(index)
		}
	},
}))

/** Resolves once every pending promise chain in the handler has settled. */
const flush = () => new Promise(resolve => setTimeout(resolve, 0))

describe('isFetchableIndex', () => {
	it('accepts a concrete index, a pattern and a comma list', () => {
		expect(isFetchableIndex('logs-2024')).toBe(true)
		expect(isFetchableIndex('logs-*')).toBe(true)
		expect(isFetchableIndex('a,b')).toBe(true)
	})

	it('refuses selections that would pull every mapping on the cluster', () => {
		expect(isFetchableIndex('_all')).toBe(false)
		expect(isFetchableIndex('*')).toBe(false)
		expect(isFetchableIndex('')).toBe(false)
		expect(isFetchableIndex('   ')).toBe(false)
		expect(isFetchableIndex(undefined)).toBe(false)
	})
})

describe('mappings store module', () => {
	let store
	let notifications

	beforeEach(() => {
		getIndex.mockReset()
		notifications = []
		store = createStoreon([
			mappings,
			s => {
				s.on('@init', () => ({ connection: { host: 'http://localhost' } }))
				s.on('notification/add', (_, payload) => {
					notifications.push(payload)
				})
			},
		])
	})

	it('initializes empty', () => {
		expect(store.get().mappings).toEqual({ info: {}, loading: {}, error: {} })
	})

	it('fetches and caches a mapping', async () => {
		getIndex.mockResolvedValue({ logs: { mappings: { properties: {} } } })

		store.dispatch('elasticsearch/mappings/fetch', { index: 'logs' })
		expect(store.get().mappings.loading.logs).toBe(true)

		await flush()

		expect(store.get().mappings.info.logs).toEqual({
			logs: { mappings: { properties: {} } },
		})
		expect(store.get().mappings.loading.logs).toBe(false)
		expect(getIndex).toHaveBeenCalledTimes(1)
	})

	it('does not refetch a cached mapping', async () => {
		getIndex.mockResolvedValue({ logs: {} })
		store.dispatch('elasticsearch/mappings/fetch', { index: 'logs' })
		await flush()

		store.dispatch('elasticsearch/mappings/fetch', { index: 'logs' })
		await flush()

		expect(getIndex).toHaveBeenCalledTimes(1)
	})

	it('refetches when forced', async () => {
		getIndex.mockResolvedValue({ logs: {} })
		store.dispatch('elasticsearch/mappings/fetch', { index: 'logs' })
		await flush()

		store.dispatch('elasticsearch/mappings/fetch', { index: 'logs', force: true })
		await flush()

		expect(getIndex).toHaveBeenCalledTimes(2)
	})

	it('skips index selections that are not worth fetching', async () => {
		store.dispatch('elasticsearch/mappings/fetch', { index: '_all' })
		store.dispatch('elasticsearch/mappings/fetch', { index: '' })
		store.dispatch('elasticsearch/mappings/fetch', {})
		await flush()

		expect(getIndex).not.toHaveBeenCalled()
	})

	it('reports a failure and clears the loading flag', async () => {
		getIndex.mockRejectedValue(new Error('index_not_found_exception'))

		store.dispatch('elasticsearch/mappings/fetch', { index: 'nope' })
		await flush()

		expect(store.get().mappings.error.nope).toBe('index_not_found_exception')
		expect(store.get().mappings.loading.nope).toBe(false)
		expect(notifications).toHaveLength(1)
		expect(notifications[0].type).toBe('error')
		expect(notifications[0].message).toContain('nope')
	})

	it('lets a failed index be retried', async () => {
		getIndex.mockRejectedValueOnce(new Error('boom'))
		store.dispatch('elasticsearch/mappings/fetch', { index: 'logs' })
		await flush()

		getIndex.mockResolvedValueOnce({ logs: {} })
		store.dispatch('elasticsearch/mappings/fetch', { index: 'logs' })
		await flush()

		expect(store.get().mappings.info.logs).toEqual({ logs: {} })
		expect(store.get().mappings.error.logs).toBeNull()
	})

	it('drops a response for an index the connection has moved on from', async () => {
		let resolveSlow
		getIndex.mockReturnValueOnce(
			new Promise(resolve => {
				resolveSlow = resolve
			})
		)

		store.dispatch('elasticsearch/mappings/fetch', { index: 'logs' })

		// Reconnecting invalidates everything already in flight.
		store.dispatch('connected')
		resolveSlow({ logs: { mappings: {} } })
		await flush()

		expect(store.get().mappings.info.logs).toBeUndefined()
		expect(store.get().mappings.loading.logs).toBeUndefined()
	})

	it('clears the cache when the connection changes', async () => {
		getIndex.mockResolvedValue({ logs: {} })
		store.dispatch('elasticsearch/mappings/fetch', { index: 'logs' })
		await flush()
		expect(store.get().mappings.info.logs).toBeDefined()

		store.dispatch('disconnected')
		expect(store.get().mappings).toEqual({ info: {}, loading: {}, error: {} })
	})
})
