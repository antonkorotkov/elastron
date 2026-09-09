import API from '../api/elasticsearch'
import debounce from 'lodash/debounce'
import get from 'lodash/get'
import isEmpty from 'lodash/isEmpty'
import isPlainObject from 'lodash/isPlainObject'
import pick from 'lodash/pick'
import { getMessageFromError } from '../utils/helpers'
import { setStorage } from '../utils/storage'

/**
 * The search view holds a list of tabs, each an independent search
 * configuration with its own results. Tabs are the only source of truth: every
 * action names the tab it writes to by id, so an outcome that arrives after the
 * user has moved on still lands where it was started.
 */

export const MAX_TABS = 20

/** What a tab is configured to search for. This is what gets persisted. */
export const defaultConfig = () => ({
	profiling: false,
	explain: false,
	type: 'uri',
	index: '_all',
	useDocType: false,
	docType: '_doc',
	useSource: false,
	_source: '',
	requestBody: {
		query: {
			bool: {
				must: {
					match_all: {},
				},
			},
		},
		size: 10,
		from: 0,
		_source: true,
	},
	uriQuery: '*',
	sort: '',
	size: 10,
	from: 0,
	view: 'hits',
})

export const CONFIG_FIELDS = Object.keys(defaultConfig())

export const emptyStats = () => ({
	total_results: 0,
	time: 0,
	total_shards: 0,
	successful_shards: 0,
	skipped_shards: 0,
	failed_shards: 0,
})

/** What a tab got back from the cluster. Never persisted. */
export const emptyResults = () => ({
	editDoc: null,
	loading: false,
	response: {},
	aggs: {},
	results: [],
	profile: {},
	stats: emptyStats(),
})

export const RESULT_FIELDS = Object.keys(emptyResults())

const newId = () =>
	globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)

/**
 * A fresh tab. `title` stays null until the user names it, so the displayed
 * title can follow the index until then.
 */
export const createTab = (overrides = {}) => ({
	id: newId(),
	title: null,
	...defaultConfig(),
	...emptyResults(),
	...overrides,
})

export const findTab = (search, id) =>
	search?.tabs?.find(tab => tab.id === id) ?? null

export const activeTab = search => findTab(search, search?.activeId)

/** What the tab bar shows: the user's name for it, else its index. */
export const tabTitle = tab => tab?.title ?? tab?.index ?? ''

const touchesConfig = patch =>
	Object.keys(patch).some(key => CONFIG_FIELDS.includes(key))

/** The persisted shape: every tab's configuration and title, and the order. */
export const serializeTabs = search => ({
	tabs: search.tabs.map(tab => ({
		id: tab.id,
		title: tab.title,
		...pick(tab, CONFIG_FIELDS),
	})),
	activeId: search.activeId,
})

/**
 * A config value from storage is kept only when it has the shape the default
 * has; anything else falls back to the default so one bad field cannot take
 * a whole tab down with it.
 */
const sanitizeConfig = raw => {
	const defaults = defaultConfig()
	const config = {}
	for (const field of CONFIG_FIELDS) {
		const value = raw?.[field]
		const expected = defaults[field]
		const ok = isPlainObject(expected)
			? isPlainObject(value)
			: typeof value === typeof expected
		config[field] = ok ? value : expected
	}
	return config
}

/**
 * Turns whatever storage held into a usable tab list: malformed or duplicate
 * tabs are skipped, an unknown active id falls back to the first tab, and an
 * empty list becomes one default tab.
 */
export const sanitizeTabs = raw => {
	const seen = new Set()
	const tabs = []
	for (const entry of Array.isArray(raw?.tabs) ? raw.tabs : []) {
		if (!isPlainObject(entry)) continue
		const id = typeof entry.id === 'string' ? entry.id.trim() : ''
		if (!id || seen.has(id)) continue
		seen.add(id)
		const title =
			typeof entry.title === 'string' && entry.title.trim()
				? entry.title.trim()
				: null
		tabs.push(createTab({ id, title, ...sanitizeConfig(entry) }))
	}

	if (tabs.length === 0) tabs.push(createTab())

	const activeId = tabs.some(tab => tab.id === raw?.activeId)
		? raw.activeId
		: tabs[0].id

	return { tabs, activeId }
}

/** Wraps the single search persisted by earlier versions as the only tab. */
export const migrateLastSearch = lastSearch => ({
	tabs: [{ id: newId(), title: null, ...sanitizeConfig(lastSearch) }],
	activeId: null,
})

// Persisting is debounced (not the dispatch, which always writes the store
// synchronously) because the body editor fires a change per keystroke and the
// payload now scales with the number of tabs. `flushSearchTabs` covers exit.
const persistTabs = debounce(
	search => setStorage('searchTabs', serializeTabs(search)),
	300
)

export const flushSearchTabs = () => {
	persistTabs.flush()
}

export const search = store => {
	store.on('@init', () => {
		const tab = createTab()
		return {
			search: {
				tabs: [tab],
				activeId: tab.id,
			},
		}
	})

	/**
	 * Another cluster means every result on screen is stale, but a tab's index
	 * and query are the user's setup and frequently make sense on the next
	 * cluster too (staging and production share index names), so those stay.
	 */
	store.on('connected', state => {
		store.dispatch('elasticsearch/indices/fetch')
		const search = {
			...state.search,
			tabs: state.search.tabs.map(tab => ({
				...tab,
				...emptyResults(),
				view: tab.view === 'edit' ? 'hits' : tab.view,
			})),
		}
		persistTabs(search)
		return { search }
	})

	store.on('search/tabs/add', (state, overrides = {}) => {
		if (state.search.tabs.length >= MAX_TABS) {
			store.dispatch('notification/add', {
				type: 'error',
				message: `You can have at most ${MAX_TABS} search tabs open. Close one to open another.`,
			})
			return
		}

		const tab = createTab(overrides)
		const search = {
			tabs: [...state.search.tabs, tab],
			activeId: tab.id,
		}
		persistTabs(search)
		return { search }
	})

	/**
	 * Closing the active tab moves to its right neighbour, or the left one when
	 * it was rightmost. Closing the only tab leaves a fresh default one, so the
	 * view is never empty.
	 */
	store.on('search/tabs/close', (state, id) => {
		const { tabs, activeId } = state.search
		const position = tabs.findIndex(tab => tab.id === id)
		if (position === -1) return

		const remaining = tabs.filter(tab => tab.id !== id)

		let search
		if (remaining.length === 0) {
			const fresh = createTab()
			search = { tabs: [fresh], activeId: fresh.id }
		} else {
			const next =
				activeId === id
					? (tabs[position + 1] ?? tabs[position - 1]).id
					: activeId
			search = { tabs: remaining, activeId: next }
		}

		persistTabs(search)
		return { search }
	})

	store.on('search/tabs/switch', (state, id) => {
		if (id === state.search.activeId || !findTab(state.search, id)) return
		const search = { ...state.search, activeId: id }
		persistTabs(search)
		return { search }
	})

	/** An empty title clears the custom name so the title follows the index. */
	store.on('search/tabs/rename', (state, { id, title }) => {
		if (!findTab(state.search, id)) return
		const next = String(title ?? '').trim() || null
		const search = {
			...state.search,
			tabs: state.search.tabs.map(tab =>
				tab.id === id ? { ...tab, title: next } : tab
			),
		}
		persistTabs(search)
		return { search }
	})

	/**
	 * Writes a patch into one tab. An id that no longer exists is a no-op, which
	 * is how a response for a closed tab gets dropped.
	 */
	store.on('search/update', (state, { id, patch } = {}) => {
		if (!patch || !findTab(state.search, id)) return

		const search = {
			...state.search,
			tabs: state.search.tabs.map(tab =>
				tab.id === id ? { ...tab, ...patch } : tab
			),
		}

		if (touchesConfig(patch)) persistTabs(search)

		return { search }
	})

	/**
	 * Replaces the tab list with what storage held, sanitized. The result is
	 * written straight back, so a migrated or repaired value is stored in its
	 * current shape from then on.
	 */
	store.on('search/hydrate', (_state, data) => {
		const search = sanitizeTabs(data)
		persistTabs(search)
		return { search }
	})

	store.on('search/loading', (state, { id, loading }) => {
		store.dispatch('search/update', { id, patch: { loading: !!loading } })
	})

	const fail = (id, error) => {
		store.dispatch('search/loading', { id, loading: false })
		store.dispatch('notification/add', {
			type: 'error',
			message: getMessageFromError(error),
		})
	}

	const replaceSource = (results, _index, _id, data) =>
		results.map(doc =>
			doc._id === _id && doc._index === _index ? { ...doc, _source: data } : doc
		)

	store.on('search/documents/reindex', async (state, { id, data }) => {
		const tab = findTab(state.search, id)
		if (!tab?.editDoc) return

		try {
			store.dispatch('search/loading', { id, loading: true })

			const { _index, _type, _id } = tab.editDoc

			const response = await new API(state.connection).indexDocument(
				_index,
				_type,
				_id,
				data
			)

			if (
				get(response, 'result') === 'updated' ||
				get(response, '_id', false)
			) {
				store.dispatch('notification/add', {
					type: 'success',
					message: `Document with id '${_id}' in index '${_index}' was successfully reindexed`,
				})

				store.dispatch('search/update', {
					id,
					patch: {
						results: replaceSource(tab.results, _index, _id, data),
						view: 'hits',
					},
				})
			}

			store.dispatch('search/loading', { id, loading: false })
		} catch (error) {
			fail(id, error)
		}
	})

	store.on('search/documents/update', async (state, { id, data }) => {
		const tab = findTab(state.search, id)
		if (!tab?.editDoc) return

		try {
			store.dispatch('search/loading', { id, loading: true })

			const { _index, _id } = tab.editDoc

			const response = await new API(state.connection).updateDocument(
				_index,
				_id,
				data
			)

			if (
				get(response, 'result') === 'updated' ||
				get(response, '_id', false)
			) {
				store.dispatch('notification/add', {
					type: 'success',
					message: `Document with id '${_id}' in index '${_index}' was successfully updated`,
				})

				store.dispatch('search/update', {
					id,
					patch: {
						results: replaceSource(tab.results, _index, _id, data),
						view: 'hits',
					},
				})
			}

			store.dispatch('search/loading', { id, loading: false })
		} catch (error) {
			fail(id, error)
		}
	})

	/** `position` is the hit's index in the tab's results, not an index name. */
	store.on('search/documents/delete', async (state, { id, position }) => {
		const tab = findTab(state.search, id)
		if (!tab) return

		try {
			store.dispatch('search/loading', { id, loading: true })

			const document = get(tab.results, position, false)

			if (document) {
				const { _index, _type, _id } = document
				const response = await new API(state.connection).deleteDocument(
					_index,
					_type,
					_id
				)
				if (get(response, 'result') === 'deleted') {
					store.dispatch('notification/add', {
						type: 'success',
						message: `Document with id '${_id}' was successfully deleted from index '${_index}'`,
					})

					const results = tab.results.filter((_v, i) => i !== position)
					store.dispatch('search/update', {
						id,
						patch: {
							results,
							stats: {
								...tab.stats,
								total_results: results.length,
							},
						},
					})
				}
			}

			store.dispatch('search/loading', { id, loading: false })
		} catch (error) {
			fail(id, error)
		}
	})

	store.on('search/run', async (state, id) => {
		const tab = findTab(state.search, id)
		if (!tab) return

		try {
			store.dispatch('search/loading', { id, loading: true })

			const params = {
				index: tab.index,
				type: tab.useDocType ? tab.docType : false,
				query: tab.type === 'uri' ? tab.uriQuery : tab.requestBody,
				size: tab.size,
				from: tab.from,
				sort: tab.sort,
				_source: tab.useSource ? tab._source : true,
				explain: tab.explain,
			}

			const api = new API(state.connection)
			let results

			switch (tab.type) {
				case 'uri':
					results = await api.uriSearch(params)
					break
				case 'body':
					results = await api.bodySearch(params)
					break
			}

			const profile = get(results, 'profile', {})
			const patch = {
				response: results,
				aggs: get(results, 'aggregations', {}),
				results: get(results, 'hits.hits', []),
				profile,
				stats: {
					total_results: get(
						results,
						'hits.total.value',
						get(results, 'hits.total', 0)
					),
					time: get(results, 'took', 0),
					total_shards: get(results, '_shards.total', 0),
					successful_shards: get(results, '_shards.successful', 0),
					skipped_shards: get(results, '_shards.skipped', 0),
					failed_shards: get(results, '_shards.failed', 0),
				},
			}

			if (tab.view === 'profile' && isEmpty(profile)) patch.view = 'hits'

			store.dispatch('search/update', { id, patch })
			store.dispatch('search/loading', { id, loading: false })
		} catch (error) {
			fail(id, error)
		}
	})
}
