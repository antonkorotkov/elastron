// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within, fireEvent } from '@testing-library/svelte'
import { userEvent } from '@testing-library/user-event'
import { tick } from 'svelte'
import { writable, get } from 'svelte/store'
import ResultsTable from './ResultsTable.svelte'

const dispatch = vi.fn()
const searchStore = writable({})
const mappingsStore = writable({ info: {}, loading: {}, error: {} })

vi.mock('@storeon/svelte', () => ({
	useStoreon: () => ({
		app: writable({ theme: 'light' }),
		search: searchStore,
		mappings: mappingsStore,
		dispatch,
	}),
}))

const hit = (id, source) => ({ _index: 'logs', _id: id, _score: 1, _source: source })

const baseSearch = {
	type: 'uri',
	view: 'table',
	index: 'logs',
	sort: '',
	from: 0,
	size: 10,
	requestBody: {},
	tableConfigs: {},
	results: [
		hit('1', { title: 'Alpha', views: 10 }),
		hit('2', { title: 'Beta', views: 20 }),
	],
}

const mapping = {
	logs: {
		mappings: {
			properties: {
				title: { type: 'text', fields: { keyword: { type: 'keyword' } } },
				body: { type: 'text' },
				views: { type: 'integer' },
			},
		},
	},
}

const setup = (search = {}, mappings = {}, props = {}) => {
	searchStore.set({ ...baseSearch, ...search })
	mappingsStore.set({ info: {}, loading: {}, error: {}, ...mappings })
	return render(ResultsTable, props)
}

const columnHeaders = () =>
	screen
		.getAllByRole('columnheader')
		.map(header => header.textContent.trim())
		.filter(Boolean)

describe('ResultsTable', () => {
	beforeEach(() => {
		dispatch.mockReset()
	})

	describe('columns', () => {
		it('falls back to _id and _source when the index has no saved layout', () => {
			setup()
			expect(columnHeaders()).toEqual(['_id', '_source'])
		})

		it('renders the saved layout for the current index', () => {
			setup({
				tableConfigs: {
					logs: {
						columns: [
							{ field: 'title', name: 'Title' },
							{ field: 'views', name: 'views' },
						],
					},
				},
			})
			expect(columnHeaders()).toEqual(['Title', 'views'])
			expect(screen.getByText('Alpha')).toBeTruthy()
			expect(screen.getByText('20')).toBeTruthy()
		})

		it('ignores a layout saved for a different index', () => {
			setup({ tableConfigs: { other: { columns: [{ field: 'title' }] } } })
			expect(columnHeaders()).toEqual(['_id', '_source'])
		})

		it('saves the layout against the index name when a field is added', async () => {
			const user = userEvent.setup()
			setup()

			await user.click(screen.getByTitle('Add views as a column'))

			expect(dispatch).toHaveBeenCalledWith('search/tableConfigs/update', {
				index: 'logs',
				config: { columns: [{ field: 'views', name: 'views' }] },
			})
		})

		it('saves an empty layout on reset, which deletes the entry', async () => {
			const user = userEvent.setup()
			setup({ tableConfigs: { logs: { columns: [{ field: 'title' }] } } })

			await user.click(screen.getByRole('button', { name: /Reset/ }))

			expect(dispatch).toHaveBeenCalledWith('search/tableConfigs/update', {
				index: 'logs',
				config: { columns: [] },
			})
		})

		it('offers metadata fields in the picker', () => {
			setup({ tableConfigs: { logs: { columns: [{ field: 'title' }] } } })
			expect(screen.getByTitle('Add _index as a column')).toBeTruthy()
			expect(screen.getByTitle('Add _score as a column')).toBeTruthy()
		})
	})

	describe('sorting', () => {
		const configured = field => ({
			tableConfigs: { logs: { columns: [{ field, name: field }] } },
		})

		it('sends the sort to the cluster and re-runs the query', async () => {
			const user = userEvent.setup()
			setup(configured('views'), { info: { logs: mapping } })

			await user.click(screen.getByRole('button', { name: 'views' }))

			expect(dispatch).toHaveBeenCalledWith('search/update', {
				sort: 'views:asc',
				from: 0,
			})
			expect(dispatch).toHaveBeenCalledWith('search/run')
		})

		it('resets the offset so page 5 of a new ordering is not shown', async () => {
			const user = userEvent.setup()
			setup({ ...configured('views'), from: 40 }, { info: { logs: mapping } })

			await user.click(screen.getByRole('button', { name: 'views' }))

			expect(dispatch).toHaveBeenCalledWith('search/update', {
				sort: 'views:asc',
				from: 0,
			})
		})

		it('flips direction when the active sort column is clicked again', async () => {
			const user = userEvent.setup()
			setup(
				{ ...configured('views'), sort: 'views:asc' },
				{ info: { logs: mapping } }
			)

			await user.click(screen.getByRole('button', { name: 'views' }))

			expect(dispatch).toHaveBeenCalledWith('search/update', {
				sort: 'views:desc',
				from: 0,
			})
		})

		it('sorts a text field through its keyword multi-field', async () => {
			const user = userEvent.setup()
			setup(configured('title'), { info: { logs: mapping } })

			await user.click(screen.getByRole('button', { name: 'title' }))

			expect(dispatch).toHaveBeenCalledWith('search/update', {
				sort: 'title.keyword:asc',
				from: 0,
			})
		})

		it('refuses to sort a field the mapping says cannot be sorted', async () => {
			const user = userEvent.setup()
			setup(configured('body'), { info: { logs: mapping } })

			const header = screen.getByRole('button', { name: 'body' })
			expect(header.disabled).toBe(true)

			await user.click(header)
			expect(dispatch).not.toHaveBeenCalledWith('search/run')
		})

		it('refuses to sort on _id, which the cluster rejects', () => {
			setup(configured('_id'), { info: { logs: mapping } })
			expect(screen.getByRole('button', { name: '_id' }).disabled).toBe(true)
		})

		it('attempts a sort on a field the mapping does not describe', async () => {
			const user = userEvent.setup()
			setup(configured('dynamic'), { info: { logs: mapping } })

			await user.click(screen.getByRole('button', { name: 'dynamic' }))

			expect(dispatch).toHaveBeenCalledWith('search/update', {
				sort: 'dynamic:asc',
				from: 0,
			})
		})

		it('writes the sort into the request body the user can see', async () => {
			const user = userEvent.setup()
			const qEditor = {
				getText: () => JSON.stringify({ query: { match_all: {} }, from: 40 }),
				set: vi.fn(),
			}
			setup(
				{ ...configured('views'), type: 'body' },
				{ info: { logs: mapping } },
				{ qEditor }
			)

			await user.click(screen.getByRole('button', { name: 'views' }))

			const expected = {
				query: { match_all: {} },
				from: 0,
				sort: [{ views: { order: 'asc' } }],
			}
			expect(qEditor.set).toHaveBeenCalledWith(expected)
			expect(dispatch).toHaveBeenCalledWith('search/update', {
				requestBody: expected,
			})
			expect(dispatch).toHaveBeenCalledWith('search/run')
		})

		it('reports a malformed request body instead of running a query', async () => {
			const user = userEvent.setup()
			const qEditor = { getText: () => '{ not json', set: vi.fn() }
			setup(
				{ ...configured('views'), type: 'body' },
				{ info: { logs: mapping } },
				{ qEditor }
			)

			await user.click(screen.getByRole('button', { name: 'views' }))

			expect(qEditor.set).not.toHaveBeenCalled()
			expect(dispatch).not.toHaveBeenCalledWith('search/run')
			expect(dispatch).toHaveBeenCalledWith(
				'notification/add',
				expect.objectContaining({ type: 'error' })
			)
		})

		it('reads the active direction out of search state, not local state', () => {
			setup(
				{ ...configured('views'), sort: 'views:desc' },
				{ info: { logs: mapping } }
			)
			const header = screen.getByRole('button', { name: 'views' })
			expect(header.querySelector('i.sort.down')).toBeTruthy()
		})
	})

	describe('row detail', () => {
		it('expands a row and switches to the JSON tab', async () => {
			const user = userEvent.setup()
			setup()

			await user.click(screen.getAllByRole('button', { name: 'Expand row' })[0])

			const detail = screen.getByRole('button', { name: 'JSON View' })
			await user.click(detail)

			// Regression: the tab was written under one row key and read under
			// another, so the JSON view could never render.
			expect(screen.getByText(/"title": "Alpha"/)).toBeTruthy()
		})

		it('keeps each expanded row on its own tab', async () => {
			const user = userEvent.setup()
			setup()

			const expanders = screen.getAllByRole('button', { name: 'Expand row' })
			await user.click(expanders[0])
			await user.click(
				screen.getAllByRole('button', { name: 'Expand row' })[0]
			)

			const jsonTabs = screen.getAllByRole('button', { name: 'JSON View' })
			await user.click(jsonTabs[0])

			expect(screen.getByText(/"title": "Alpha"/)).toBeTruthy()
			expect(screen.queryByText(/"title": "Beta"/)).toBeNull()
		})

		it('adds a column from the row detail', async () => {
			const user = userEvent.setup()
			setup({ tableConfigs: { logs: { columns: [{ field: 'title' }] } } })

			await user.click(screen.getAllByRole('button', { name: 'Expand row' })[0])

			const viewsRow = screen
				.getByText('views', { selector: '.field-key' })
				.closest('tr')
			await user.click(within(viewsRow).getByRole('button', { name: 'Add' }))

			expect(dispatch).toHaveBeenCalledWith('search/tableConfigs/update', {
				index: 'logs',
				config: {
					columns: [
						{ field: 'title', name: 'title' },
						{ field: 'views', name: 'views' },
					],
				},
			})
		})
	})

	describe('column resizing', () => {
		const resizerFor = name =>
			screen
				.getByRole('button', { name })
				.closest('th')
				.querySelector('.col-resizer')

		const drag = (handle, distance) => {
			fireEvent.mouseDown(handle, { clientX: 100 })
			fireEvent.mouseMove(window, { clientX: 100 + distance })
			fireEvent.mouseUp(window)
		}

		it('persists the new width against the column that was dragged', async () => {
			setup({
				tableConfigs: {
					logs: {
						columns: [{ field: 'title', name: 'title' }, { field: 'views' }],
					},
				},
			})

			drag(resizerFor('title'), 60)
			await tick()

			expect(dispatch).toHaveBeenCalledWith('search/tableConfigs/update', {
				index: 'logs',
				config: {
					columns: [
						{ field: 'title', name: 'title', width: 280 },
						{ field: 'views', name: 'views' },
					],
				},
			})
		})

		it('clamps a drag that would collapse the column', async () => {
			setup({ tableConfigs: { logs: { columns: [{ field: 'title' }] } } })

			drag(resizerFor('title'), -1000)
			await tick()

			const [, payload] = dispatch.mock.calls.find(
				([event]) => event === 'search/tableConfigs/update'
			)
			expect(payload.config.columns[0].width).toBe(60)
		})

		it('does not save a layout when the handle is clicked but never moved', async () => {
			// Otherwise a stray click would turn an index with no saved columns
			// into a configured one holding nothing but the defaults.
			setup()

			const handle = resizerFor('_id')
			fireEvent.mouseDown(handle, { clientX: 100 })
			fireEvent.mouseUp(window)
			await tick()

			expect(dispatch).not.toHaveBeenCalledWith(
				'search/tableConfigs/update',
				expect.anything()
			)
		})
	})

	describe('result volume', () => {
		it('reports how many documents are shown', () => {
			setup()
			expect(screen.getByText(/Showing 2 documents/)).toBeTruthy()
		})

		it('caps rendered rows and says so', () => {
			const many = Array.from({ length: 600 }, (_, i) =>
				hit(String(i), { title: `doc ${i}` })
			)
			setup({ results: many })

			expect(screen.getByText(/Showing 500 of 600 documents/)).toBeTruthy()
			expect(
				screen.getAllByRole('button', { name: 'Expand row' })
			).toHaveLength(500)
		})

		it('shows an empty state when there are no hits', () => {
			setup({ results: [] })
			expect(screen.getByText(/No search results found/)).toBeTruthy()
		})
	})

	describe('mapping fetch', () => {
		it('requests the mapping once the table is the active view', () => {
			setup()
			expect(dispatch).toHaveBeenCalledWith('elasticsearch/mappings/fetch', {
				index: 'logs',
			})
		})

		it('does not fetch while another view is showing', () => {
			setup({ view: 'hits' })
			expect(dispatch).not.toHaveBeenCalledWith(
				'elasticsearch/mappings/fetch',
				expect.anything()
			)
		})

		it('does not fetch for an index selection covering the whole cluster', () => {
			setup({ index: '_all' })
			expect(dispatch).not.toHaveBeenCalledWith(
				'elasticsearch/mappings/fetch',
				expect.anything()
			)
		})

		const fetchCount = () =>
			dispatch.mock.calls.filter(
				([event]) => event === 'elasticsearch/mappings/fetch'
			).length

		it('does not refetch when unrelated search state changes', async () => {
			setup()
			expect(fetchCount()).toBe(1)

			searchStore.update(state => ({ ...state, loading: true }))
			await tick()

			expect(fetchCount()).toBe(1)
		})

		it('refetches when the selected index changes', async () => {
			setup()
			expect(fetchCount()).toBe(1)

			searchStore.update(state => ({ ...state, index: 'metrics' }))
			await tick()

			expect(dispatch).toHaveBeenCalledWith('elasticsearch/mappings/fetch', {
				index: 'metrics',
			})
			expect(fetchCount()).toBe(2)
		})

		it('fetches when the table becomes the active view', async () => {
			setup({ view: 'hits' })
			expect(fetchCount()).toBe(0)

			searchStore.update(state => ({ ...state, view: 'table' }))
			await tick()

			expect(fetchCount()).toBe(1)
		})

		it('lists fields from the mapping that no hit contains', () => {
			setup({}, { info: { logs: mapping } })
			expect(screen.getByTitle('Add body as a column')).toBeTruthy()
			expect(get(searchStore).results.every(h => !('body' in h._source))).toBe(
				true
			)
		})
	})
})
