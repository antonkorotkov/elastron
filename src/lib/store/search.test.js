import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createStoreon } from 'storeon'
import { search } from './search'

const { setStorage } = vi.hoisted(() => ({ setStorage: vi.fn() }))

vi.mock('../utils/storage', () => ({
	setStorage,
	getStorage: vi.fn(),
}))

vi.mock('../api/elasticsearch', () => ({
	default: class API {},
}))

describe('search store — table configuration', () => {
	let store

	beforeEach(() => {
		setStorage.mockReset()
		store = createStoreon([search])
	})

	const configs = () => store.get().search.tableConfigs

	it('initializes with no saved layouts', () => {
		expect(configs()).toEqual({})
	})

	it('saves a layout keyed by index name', () => {
		store.dispatch('search/tableConfigs/update', {
			index: 'logs-2024',
			config: { columns: [{ field: 'title', name: 'Title' }] },
		})

		expect(configs()).toEqual({
			'logs-2024': { columns: [{ field: 'title', name: 'Title' }] },
		})
		expect(setStorage).toHaveBeenCalledWith('tableConfigs', configs())
	})

	it('keeps layouts for different indices independent', () => {
		store.dispatch('search/tableConfigs/update', {
			index: 'a',
			config: { columns: [{ field: 'x' }] },
		})
		store.dispatch('search/tableConfigs/update', {
			index: 'b',
			config: { columns: [{ field: 'y' }] },
		})

		expect(Object.keys(configs())).toEqual(['a', 'b'])
	})

	it('cannot collide two index names that share a separator', () => {
		// The previous `${connection}_${index}` key made `a_b`+`c` and `a`+`b_c`
		// the same entry.
		store.dispatch('search/tableConfigs/update', {
			index: 'a_b',
			config: { columns: [{ field: 'x' }] },
		})
		store.dispatch('search/tableConfigs/update', {
			index: 'b_c',
			config: { columns: [{ field: 'y' }] },
		})

		expect(configs()['a_b'].columns[0].field).toBe('x')
		expect(configs()['b_c'].columns[0].field).toBe('y')
	})

	it('deletes the entry when the last column is removed', () => {
		store.dispatch('search/tableConfigs/update', {
			index: 'logs',
			config: { columns: [{ field: 'title' }] },
		})
		store.dispatch('search/tableConfigs/update', {
			index: 'logs',
			config: { columns: [] },
		})

		expect(configs()).toEqual({})
		expect(setStorage).toHaveBeenLastCalledWith('tableConfigs', {})
	})

	it('falls back to `_all` for a blank index', () => {
		store.dispatch('search/tableConfigs/update', {
			index: '   ',
			config: { columns: [{ field: 'title' }] },
		})

		expect(Object.keys(configs())).toEqual(['_all'])
	})

	it('drops unusable columns before persisting', () => {
		store.dispatch('search/tableConfigs/update', {
			index: 'logs',
			config: { columns: [{ field: 'title' }, null, { name: 'no field' }] },
		})

		expect(configs().logs.columns).toEqual([{ field: 'title', name: 'title' }])
	})

	it('sanitizes a hydrated value rather than trusting storage', () => {
		store.dispatch('search/tableConfigs/hydrate', {
			good: { columns: [{ field: 'a' }] },
			broken: { columns: 'nope' },
		})

		expect(configs()).toEqual({ good: { columns: [{ field: 'a', name: 'a' }] } })
	})

	it('hydrates to an empty map when storage holds nothing usable', () => {
		store.dispatch('search/tableConfigs/hydrate', undefined)
		expect(configs()).toEqual({})
	})

	it('keeps layouts out of the persisted last search', () => {
		store.dispatch('search/tableConfigs/update', {
			index: 'logs',
			config: { columns: [{ field: 'title' }] },
		})
		setStorage.mockReset()

		store.dispatch('search/update', { index: 'logs' })

		const [, persisted] = setStorage.mock.calls[0]
		expect(persisted.tableConfigs).toBeUndefined()
		expect(persisted.index).toBe('logs')
		// The state itself still has them.
		expect(configs().logs).toBeDefined()
	})
})
