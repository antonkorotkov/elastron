import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createStoreon } from 'storeon'
import {
	search,
	createTab,
	findTab,
	activeTab,
	tabTitle,
	defaultConfig,
	emptyResults,
	CONFIG_FIELDS,
	RESULT_FIELDS,
	MAX_TABS,
	flushSearchTabs,
	migrateLastSearch,
} from './search'

const { setStorage, api } = vi.hoisted(() => ({
	setStorage: vi.fn(),
	api: {
		uriSearch: vi.fn(),
		bodySearch: vi.fn(),
		deleteDocument: vi.fn(),
		updateDocument: vi.fn(),
		indexDocument: vi.fn(),
	},
}))

vi.mock('../utils/storage', () => ({
	setStorage,
	getStorage: vi.fn(),
}))

vi.mock('../api/elasticsearch', () => ({
	default: class API {
		uriSearch = api.uriSearch
		bodySearch = api.bodySearch
		deleteDocument = api.deleteDocument
		updateDocument = api.updateDocument
		indexDocument = api.indexDocument
	},
}))

/** Lets a test install any tab list until the lifecycle actions exist. */
const testing = store => {
	store.on('test/set', (_state, next) => ({ search: next }))
}

/** A promise the test resolves by hand, to order responses against actions. */
const deferred = () => {
	let resolve, reject
	const promise = new Promise((res, rej) => {
		resolve = res
		reject = rej
	})
	return { promise, resolve, reject }
}

const flush = () => new Promise(resolve => setTimeout(resolve, 0))

describe('search store', () => {
	let store, notifications

	beforeEach(() => {
		// A write scheduled by the previous test must not land in this one.
		flushSearchTabs()
		setStorage.mockReset()
		Object.values(api).forEach(fn => fn.mockReset())
		notifications = []
		store = createStoreon([
			search,
			testing,
			s => s.on('notification/add', (_state, n) => void notifications.push(n)),
		])
	})

	const state = () => store.get().search
	const tab = id => findTab(state(), id)

	const twoTabs = () => {
		const a = createTab({ index: 'a' })
		const b = createTab({ index: 'b' })
		store.dispatch('test/set', { tabs: [a, b], activeId: a.id })
		return { a, b }
	}

	describe('tab factory', () => {
		it('produces the default configuration with empty results', () => {
			const created = createTab()

			expect(created.id).toEqual(expect.any(String))
			expect(created.title).toBeNull()
			expect(created).toMatchObject(defaultConfig())
			expect(created).toMatchObject(emptyResults())
		})

		it('applies overrides', () => {
			expect(createTab({ index: 'logs', size: 50 })).toMatchObject({
				index: 'logs',
				size: 50,
			})
		})

		it('gives every tab its own id', () => {
			expect(createTab().id).not.toBe(createTab().id)
		})

		it('keeps configuration and result fields disjoint', () => {
			expect(CONFIG_FIELDS.filter(f => RESULT_FIELDS.includes(f))).toEqual([])
		})
	})

	describe('lookup', () => {
		it('finds a tab by id and the active tab', () => {
			const { a, b } = twoTabs()

			expect(findTab(state(), b.id).index).toBe('b')
			expect(activeTab(state()).id).toBe(a.id)
		})

		it('returns null for an unknown id or missing state', () => {
			expect(findTab(state(), 'nope')).toBeNull()
			expect(findTab(undefined, 'nope')).toBeNull()
			expect(activeTab({ tabs: [], activeId: 'x' })).toBeNull()
		})
	})

	describe('initial state', () => {
		it('starts with one default tab that is active', () => {
			expect(state().tabs).toHaveLength(1)
			expect(state().activeId).toBe(state().tabs[0].id)
			expect(state().tabs[0]).toMatchObject(defaultConfig())
		})
	})

	describe('search/update', () => {
		it('patches only the addressed tab', () => {
			const { a, b } = twoTabs()

			store.dispatch('search/update', { id: b.id, patch: { size: 25 } })

			expect(tab(b.id).size).toBe(25)
			expect(tab(a.id).size).toBe(10)
		})

		it('ignores an unknown id', () => {
			const before = state()

			store.dispatch('search/update', { id: 'gone', patch: { size: 25 } })

			expect(state()).toBe(before)
		})

		it('ignores a missing patch', () => {
			const before = state()

			store.dispatch('search/update', { id: state().activeId })

			expect(state()).toBe(before)
		})

		it('persists every tab when a config field changes', () => {
			const { a, b } = twoTabs()

			store.dispatch('search/update', { id: b.id, patch: { index: 'logs' } })
			flushSearchTabs()

			const [key, persisted] = setStorage.mock.calls[0]
			expect(key).toBe('searchTabs')
			expect(persisted.activeId).toBe(a.id)
			expect(persisted.tabs.map(t => t.index)).toEqual(['a', 'logs'])
			expect(Object.keys(persisted.tabs[0]).sort()).toEqual(
				['id', 'title', ...CONFIG_FIELDS].sort()
			)
		})

		it('does not persist a results-only patch', () => {
			store.dispatch('search/update', {
				id: state().activeId,
				patch: { results: [{ _id: '1' }], loading: true, stats: {} },
			})
			flushSearchTabs()

			expect(setStorage).not.toHaveBeenCalled()
		})

		it('coalesces a burst of edits into one write', () => {
			const id = state().activeId
			for (const uriQuery of ['a', 'ab', 'abc']) {
				store.dispatch('search/update', { id, patch: { uriQuery } })
			}
			flushSearchTabs()

			expect(setStorage).toHaveBeenCalledTimes(1)
			expect(setStorage.mock.calls[0][1].tabs[0].uriQuery).toBe('abc')
		})
	})

	describe('persistence of tab lifecycle', () => {
		const persistedAfter = action => {
			setStorage.mockReset()
			action()
			flushSearchTabs()
			expect(setStorage).toHaveBeenCalledTimes(1)
			return setStorage.mock.calls[0][1]
		}

		it('persists add, close, switch and rename', () => {
			const { a, b } = twoTabs()

			expect(persistedAfter(() => store.dispatch('search/tabs/switch', b.id)).activeId).toBe(b.id)
			expect(persistedAfter(() => store.dispatch('search/tabs/rename', { id: a.id, title: 'N' })).tabs[0].title).toBe('N')
			expect(persistedAfter(() => store.dispatch('search/tabs/add')).tabs).toHaveLength(3)
			expect(persistedAfter(() => store.dispatch('search/tabs/close', a.id)).tabs).toHaveLength(2)
		})

		it('never persists results', () => {
			const { a } = twoTabs()
			store.dispatch('search/update', {
				id: a.id,
				patch: { results: [{ _id: '1' }], response: { took: 1 }, index: 'x' },
			})
			flushSearchTabs()

			const persisted = setStorage.mock.calls[0][1]
			for (const field of RESULT_FIELDS) {
				expect(persisted.tabs[0][field]).toBeUndefined()
			}
		})
	})

	describe('search/hydrate', () => {
		const persistedTab = (overrides = {}) => ({
			id: 't1',
			title: null,
			...defaultConfig(),
			index: 'restored',
			...overrides,
		})

		it('restores tabs, order, titles and the active tab', () => {
			store.dispatch('search/hydrate', {
				tabs: [
					persistedTab({ id: 'one', index: 'a' }),
					persistedTab({ id: 'two', index: 'b', title: 'Named', size: 50 }),
					persistedTab({ id: 'three', index: 'c' }),
				],
				activeId: 'two',
			})

			expect(state().tabs.map(t => t.id)).toEqual(['one', 'two', 'three'])
			expect(state().activeId).toBe('two')
			expect(tab('two')).toMatchObject({ index: 'b', title: 'Named', size: 50 })
			expect(tab('two')).toMatchObject(emptyResults())
		})

		it('drops unknown fields and fills missing config from the defaults', () => {
			store.dispatch('search/hydrate', {
				tabs: [{ id: 't1', index: 'logs', bogus: 1, results: [{ _id: 'x' }] }],
				activeId: 't1',
			})

			expect(tab('t1').bogus).toBeUndefined()
			expect(tab('t1').results).toEqual([])
			expect(tab('t1')).toMatchObject({ ...defaultConfig(), index: 'logs' })
		})

		it('replaces a config value of the wrong shape with its default', () => {
			store.dispatch('search/hydrate', {
				tabs: [persistedTab({ size: 'ten', requestBody: 'nope', explain: 'yes' })],
				activeId: 't1',
			})

			expect(tab('t1').size).toBe(10)
			expect(tab('t1').requestBody).toEqual(defaultConfig().requestBody)
			expect(tab('t1').explain).toBe(false)
			expect(tab('t1').index).toBe('restored')
		})

		it('skips malformed and duplicate tabs', () => {
			store.dispatch('search/hydrate', {
				tabs: [null, 'x', { title: 'no id' }, persistedTab({ id: 'dup' }), persistedTab({ id: 'dup' }), persistedTab({ id: 'ok' })],
				activeId: 'ok',
			})

			expect(state().tabs.map(t => t.id)).toEqual(['dup', 'ok'])
		})

		it('falls back to the first tab when the active id is unknown', () => {
			store.dispatch('search/hydrate', {
				tabs: [persistedTab({ id: 'first' }), persistedTab({ id: 'second' })],
				activeId: 'gone',
			})

			expect(state().activeId).toBe('first')
		})

		it('starts with one default tab when nothing usable was stored', () => {
			for (const raw of [undefined, null, {}, { tabs: [] }, { tabs: 'nope' }, { tabs: [null] }]) {
				store.dispatch('search/hydrate', raw)

				expect(state().tabs).toHaveLength(1)
				expect(state().tabs[0]).toMatchObject(defaultConfig())
				expect(state().activeId).toBe(state().tabs[0].id)
			}
		})

		it('writes the sanitized value back so a repair happens once', () => {
			store.dispatch('search/hydrate', { tabs: [persistedTab({ size: 'ten' })], activeId: 'gone' })
			flushSearchTabs()

			expect(setStorage).toHaveBeenCalledWith('searchTabs', {
				tabs: [persistedTab({ size: 10 })],
				activeId: 't1',
			})
		})
	})

	describe('migration from a single persisted search', () => {
		it('wraps the old search as the only tab', () => {
			const lastSearch = { ...defaultConfig(), index: 'legacy', type: 'body', size: 7 }

			store.dispatch('search/hydrate', migrateLastSearch(lastSearch))
			flushSearchTabs()

			expect(state().tabs).toHaveLength(1)
			expect(activeTab(state())).toMatchObject({ index: 'legacy', type: 'body', size: 7, title: null })
			expect(setStorage.mock.calls[0][0]).toBe('searchTabs')
		})

		it('survives a corrupted old search', () => {
			store.dispatch('search/hydrate', migrateLastSearch({ size: 'x', index: 3 }))

			expect(activeTab(state())).toMatchObject(defaultConfig())
		})
	})

	describe('search/run', () => {
		const response = {
			took: 3,
			hits: { total: { value: 1 }, hits: [{ _id: '1', _index: 'a' }] },
			_shards: { total: 1, successful: 1, skipped: 0, failed: 0 },
		}

		it('lands results in the tab it was started from after the active tab changed', async () => {
			const { a, b } = twoTabs()
			const pending = deferred()
			api.uriSearch.mockReturnValue(pending.promise)

			store.dispatch('search/run', a.id)
			expect(tab(a.id).loading).toBe(true)
			expect(tab(b.id).loading).toBe(false)

			store.dispatch('test/set', { ...state(), activeId: b.id })
			pending.resolve(response)
			await flush()

			expect(tab(a.id).results).toEqual(response.hits.hits)
			expect(tab(a.id).stats.total_results).toBe(1)
			expect(tab(a.id).loading).toBe(false)
			expect(tab(b.id).results).toEqual([])
		})

		it('drops the response when the tab was closed before it arrived', async () => {
			const { a, b } = twoTabs()
			const pending = deferred()
			api.uriSearch.mockReturnValue(pending.promise)

			store.dispatch('search/run', a.id)
			store.dispatch('test/set', { tabs: [b], activeId: b.id })
			pending.resolve(response)
			await flush()

			expect(state().tabs).toHaveLength(1)
			expect(tab(b.id).results).toEqual([])
			expect(notifications).toEqual([])
		})

		it('reports an error against the originating tab', async () => {
			const { a, b } = twoTabs()
			api.uriSearch.mockRejectedValue(new Error('boom'))

			store.dispatch('search/run', a.id)
			store.dispatch('test/set', { ...state(), activeId: b.id })
			await flush()

			expect(tab(a.id).loading).toBe(false)
			expect(tab(b.id).loading).toBe(false)
			expect(notifications).toEqual([
				expect.objectContaining({ type: 'error', message: 'boom' }),
			])
		})

		it('sends the tab configuration, not the active tab configuration', async () => {
			const { a, b } = twoTabs()
			store.dispatch('test/set', { ...state(), activeId: b.id })
			api.uriSearch.mockResolvedValue(response)

			store.dispatch('search/run', a.id)
			await flush()

			expect(api.uriSearch).toHaveBeenCalledWith(
				expect.objectContaining({ index: 'a' })
			)
		})

		it('uses the body search for a body-type tab', async () => {
			const t = createTab({ type: 'body', index: 'x' })
			store.dispatch('test/set', { tabs: [t], activeId: t.id })
			api.bodySearch.mockResolvedValue(response)

			store.dispatch('search/run', t.id)
			await flush()

			expect(api.bodySearch).toHaveBeenCalledWith(
				expect.objectContaining({ index: 'x', query: t.requestBody })
			)
			expect(api.uriSearch).not.toHaveBeenCalled()
		})

		it('leaves the profile view when the response has no profile', async () => {
			const t = createTab({ view: 'profile' })
			store.dispatch('test/set', { tabs: [t], activeId: t.id })
			api.uriSearch.mockResolvedValue(response)

			store.dispatch('search/run', t.id)
			await flush()

			expect(tab(t.id).view).toBe('hits')
		})

		it('ignores an unknown tab', async () => {
			store.dispatch('search/run', 'gone')
			await flush()

			expect(api.uriSearch).not.toHaveBeenCalled()
		})
	})

	describe('search/documents', () => {
		const hits = [
			{ _index: 'a', _id: '1', _source: { n: 1 } },
			{ _index: 'a', _id: '2', _source: { n: 2 } },
		]

		it('deletes from the originating tab after the active tab changed', async () => {
			const { a, b } = twoTabs()
			store.dispatch('search/update', {
				id: a.id,
				patch: { results: hits, stats: { total_results: 2 } },
			})
			const pending = deferred()
			api.deleteDocument.mockReturnValue(pending.promise)

			store.dispatch('search/documents/delete', { id: a.id, position: 0 })
			store.dispatch('test/set', { ...state(), activeId: b.id })
			pending.resolve({ result: 'deleted' })
			await flush()

			expect(tab(a.id).results).toEqual([hits[1]])
			expect(tab(a.id).stats.total_results).toBe(1)
			expect(tab(b.id).results).toEqual([])
		})

		it('updates the edited document in the originating tab', async () => {
			const { a, b } = twoTabs()
			store.dispatch('search/update', {
				id: a.id,
				patch: { results: hits, editDoc: hits[0], view: 'edit' },
			})
			api.updateDocument.mockResolvedValue({ result: 'updated' })

			store.dispatch('search/documents/update', { id: a.id, data: { n: 9 } })
			store.dispatch('test/set', { ...state(), activeId: b.id })
			await flush()

			expect(api.updateDocument).toHaveBeenCalledWith('a', '1', { n: 9 })
			expect(tab(a.id).results[0]._source).toEqual({ n: 9 })
			expect(tab(a.id).view).toBe('hits')
			expect(tab(b.id).results).toEqual([])
		})

		it('reindexes the edited document in the originating tab', async () => {
			const { a } = twoTabs()
			store.dispatch('search/update', {
				id: a.id,
				patch: { results: hits, editDoc: hits[1] },
			})
			api.indexDocument.mockResolvedValue({ _id: '2' })

			store.dispatch('search/documents/reindex', { id: a.id, data: { n: 7 } })
			await flush()

			expect(tab(a.id).results[1]._source).toEqual({ n: 7 })
		})

		it('does nothing without a document being edited', async () => {
			const { a } = twoTabs()

			store.dispatch('search/documents/update', { id: a.id, data: {} })
			await flush()

			expect(api.updateDocument).not.toHaveBeenCalled()
		})

		it('drops the outcome when the tab was closed', async () => {
			const { a, b } = twoTabs()
			store.dispatch('search/update', { id: a.id, patch: { results: hits } })
			const pending = deferred()
			api.deleteDocument.mockReturnValue(pending.promise)

			store.dispatch('search/documents/delete', { id: a.id, position: 0 })
			store.dispatch('test/set', { tabs: [b], activeId: b.id })
			pending.resolve({ result: 'deleted' })
			await flush()

			expect(state().tabs).toHaveLength(1)
			expect(tab(b.id).results).toEqual([])
		})
	})

	describe('connected', () => {
		it('drops results in every tab but keeps their configuration', () => {
			const { a, b } = twoTabs()
			store.dispatch('search/update', {
				id: a.id,
				patch: { results: [{ _id: '1' }], stats: { total_results: 1 }, uriQuery: 'x' },
			})
			store.dispatch('search/update', {
				id: b.id,
				patch: { response: { took: 1 }, aggs: { k: 1 }, profile: { p: 1 } },
			})

			store.dispatch('connected')

			expect(tab(a.id)).toMatchObject({ index: 'a', uriQuery: 'x', ...emptyResults() })
			expect(tab(b.id)).toMatchObject({ index: 'b', ...emptyResults() })
		})

		it('leaves the edit view and forgets the document being edited', () => {
			const { a, b } = twoTabs()
			store.dispatch('search/update', {
				id: a.id,
				patch: { view: 'edit', editDoc: { _id: '1' } },
			})
			store.dispatch('search/update', { id: b.id, patch: { view: 'table' } })

			store.dispatch('connected')

			expect(tab(a.id).view).toBe('hits')
			expect(tab(a.id).editDoc).toBeNull()
			expect(tab(b.id).view).toBe('table')
		})
	})

	describe('search/tabs/add', () => {
		it('appends a default tab and activates it', () => {
			const { a } = twoTabs()

			store.dispatch('search/tabs/add')

			expect(state().tabs).toHaveLength(3)
			const added = state().tabs[2]
			expect(added).toMatchObject(defaultConfig())
			expect(added.title).toBeNull()
			expect(state().activeId).toBe(added.id)
			expect(state().tabs[0].id).toBe(a.id)
		})

		it('accepts overrides for the new tab', () => {
			store.dispatch('search/tabs/add', { index: 'logs' })

			expect(activeTab(state()).index).toBe('logs')
		})

		it('refuses at the cap and says why', () => {
			const tabs = Array.from({ length: MAX_TABS }, () => createTab())
			store.dispatch('test/set', { tabs, activeId: tabs[0].id })

			store.dispatch('search/tabs/add')

			expect(state().tabs).toHaveLength(MAX_TABS)
			expect(state().activeId).toBe(tabs[0].id)
			expect(notifications).toEqual([
				expect.objectContaining({ type: 'error', message: expect.stringContaining(String(MAX_TABS)) }),
			])
		})
	})

	describe('search/tabs/open', () => {
		it('appends an active default tab on the index and runs it', () => {
			const { a } = twoTabs()
			api.uriSearch.mockResolvedValue({})

			store.dispatch('search/tabs/open', { index: 'products' })

			expect(state().tabs).toHaveLength(3)
			const opened = state().tabs[2]
			expect(opened).toMatchObject({ ...defaultConfig(), index: 'products' })
			expect(opened.title).toBeNull()
			expect(tabTitle(opened)).toBe('products')
			expect(state().activeId).toBe(opened.id)
			expect(opened.loading).toBe(true)
			expect(api.uriSearch).toHaveBeenCalledTimes(1)
			expect(api.uriSearch).toHaveBeenCalledWith(
				expect.objectContaining({ index: 'products' })
			)
			expect(tab(a.id).loading).toBe(false)
		})

		it('lands the results in the opened tab', async () => {
			const hits = [{ _id: '1', _index: 'products' }]
			api.uriSearch.mockResolvedValue({ hits: { total: { value: 1 }, hits } })

			store.dispatch('search/tabs/open', { index: 'products' })
			await flush()

			expect(activeTab(state()).results).toEqual(hits)
			expect(activeTab(state()).loading).toBe(false)
		})

		it('refuses at the cap, runs nothing and says why', () => {
			const tabs = Array.from({ length: MAX_TABS }, () => createTab())
			store.dispatch('test/set', { tabs, activeId: tabs[0].id })

			store.dispatch('search/tabs/open', { index: 'products' })

			expect(state().tabs).toHaveLength(MAX_TABS)
			expect(state().activeId).toBe(tabs[0].id)
			expect(api.uriSearch).not.toHaveBeenCalled()
			expect(notifications).toEqual([
				expect.objectContaining({ type: 'error', message: expect.stringContaining(String(MAX_TABS)) }),
			])
		})

		it('opens a second tab when one on that index already exists', () => {
			const existing = createTab({ index: 'products', uriQuery: 'name:x', results: [{ _id: '9' }] })
			store.dispatch('test/set', { tabs: [existing], activeId: existing.id })
			api.uriSearch.mockResolvedValue({})

			store.dispatch('search/tabs/open', { index: 'products' })

			expect(state().tabs).toHaveLength(2)
			expect(state().activeId).not.toBe(existing.id)
			expect(tab(existing.id)).toMatchObject({
				uriQuery: 'name:x',
				results: [{ _id: '9' }],
				loading: false,
			})
			expect(activeTab(state()).uriQuery).toBe('*')
		})

		it('persists the opened tab with its index', () => {
			twoTabs()
			api.uriSearch.mockResolvedValue({})
			setStorage.mockReset()

			store.dispatch('search/tabs/open', { index: 'products' })
			flushSearchTabs()

			expect(setStorage).toHaveBeenCalledTimes(1)
			const [key, persisted] = setStorage.mock.calls[0]
			expect(key).toBe('searchTabs')
			expect(persisted.tabs).toHaveLength(3)
			expect(persisted.tabs[2].index).toBe('products')
			expect(persisted.activeId).toBe(persisted.tabs[2].id)
		})
	})

	describe('search/tabs/close', () => {
		const threeTabs = () => {
			const tabs = [createTab({ index: 'a' }), createTab({ index: 'b' }), createTab({ index: 'c' })]
			return tabs
		}

		it('removes an inactive tab and keeps the active one', () => {
			const [a, b, c] = threeTabs()
			store.dispatch('test/set', { tabs: [a, b, c], activeId: b.id })

			store.dispatch('search/tabs/close', c.id)

			expect(state().tabs.map(t => t.id)).toEqual([a.id, b.id])
			expect(state().activeId).toBe(b.id)
		})

		it('activates the right neighbour when the active tab closes', () => {
			const [a, b, c] = threeTabs()
			store.dispatch('test/set', { tabs: [a, b, c], activeId: a.id })

			store.dispatch('search/tabs/close', a.id)

			expect(state().tabs.map(t => t.id)).toEqual([b.id, c.id])
			expect(state().activeId).toBe(b.id)
		})

		it('activates the left neighbour when the rightmost active tab closes', () => {
			const [a, b, c] = threeTabs()
			store.dispatch('test/set', { tabs: [a, b, c], activeId: c.id })

			store.dispatch('search/tabs/close', c.id)

			expect(state().activeId).toBe(b.id)
		})

		it('replaces the only tab with a fresh default one', () => {
			const only = state().tabs[0]
			store.dispatch('search/update', { id: only.id, patch: { index: 'logs' } })

			store.dispatch('search/tabs/close', only.id)

			expect(state().tabs).toHaveLength(1)
			expect(state().tabs[0].id).not.toBe(only.id)
			expect(state().tabs[0]).toMatchObject(defaultConfig())
			expect(state().activeId).toBe(state().tabs[0].id)
		})

		it('ignores an unknown id', () => {
			const before = state()

			store.dispatch('search/tabs/close', 'gone')

			expect(state()).toBe(before)
		})

		it('drops a response that arrives after the tab closed', async () => {
			const { a, b } = twoTabs()
			const pending = deferred()
			api.uriSearch.mockReturnValue(pending.promise)

			store.dispatch('search/run', a.id)
			store.dispatch('search/tabs/close', a.id)
			pending.resolve({ hits: { hits: [{ _id: '1' }] } })
			await flush()

			expect(state().tabs.map(t => t.id)).toEqual([b.id])
			expect(tab(b.id).results).toEqual([])
			expect(tab(b.id).loading).toBe(false)
		})
	})

	describe('search/tabs/switch', () => {
		it('activates the requested tab', () => {
			const { b } = twoTabs()

			store.dispatch('search/tabs/switch', b.id)

			expect(state().activeId).toBe(b.id)
		})

		it('ignores an unknown id and a no-op switch', () => {
			twoTabs()
			const before = state()

			store.dispatch('search/tabs/switch', 'gone')
			store.dispatch('search/tabs/switch', before.activeId)

			expect(state()).toBe(before)
		})
	})

	describe('titles', () => {
		it('follows the index until the user names the tab', () => {
			const { a } = twoTabs()
			expect(tabTitle(tab(a.id))).toBe('a')

			store.dispatch('search/update', { id: a.id, patch: { index: 'products' } })

			expect(tabTitle(tab(a.id))).toBe('products')
		})

		it('keeps a custom name when the index changes', () => {
			const { a } = twoTabs()

			store.dispatch('search/tabs/rename', { id: a.id, title: '  Recent orders ' })
			store.dispatch('search/update', { id: a.id, patch: { index: 'products' } })

			expect(tab(a.id).title).toBe('Recent orders')
			expect(tabTitle(tab(a.id))).toBe('Recent orders')
		})

		it('clears the custom name on an empty rename', () => {
			const { a } = twoTabs()
			store.dispatch('search/tabs/rename', { id: a.id, title: 'Named' })

			store.dispatch('search/tabs/rename', { id: a.id, title: '   ' })

			expect(tab(a.id).title).toBeNull()
			expect(tabTitle(tab(a.id))).toBe('a')
		})

		it('ignores a rename of an unknown tab', () => {
			const before = state()

			store.dispatch('search/tabs/rename', { id: 'gone', title: 'x' })

			expect(state()).toBe(before)
		})
	})
})
