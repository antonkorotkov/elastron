// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/svelte'
import { userEvent } from '@testing-library/user-event'
import RowDetail from './RowDetail.svelte'

const hit = {
	_index: 'logs',
	_id: 'abc',
	_score: 1.5,
	_source: { title: 'Alpha', user: { name: 'Ada' }, tags: ['a', 'b'] },
}

const fieldRow = field =>
	screen.getByText(field, { selector: '.field-key' }).closest('tr')

describe('RowDetail', () => {
	let props

	beforeEach(() => {
		props = {
			hit,
			columns: [{ field: 'title', name: 'title' }],
			onTab: vi.fn(),
			onToggleColumn: vi.fn(),
			onCopy: vi.fn(),
		}
	})

	it('lists metadata before the document fields', () => {
		render(RowDetail, props)

		const keys = screen
			.getAllByText(/.+/, { selector: '.field-key' })
			.map(node => node.textContent)

		expect(keys).toEqual([
			'_id',
			'_index',
			'_score',
			'title',
			'user',
			'user.name',
			'tags',
		])
	})

	it('renders values, keeping arrays intact', () => {
		render(RowDetail, props)
		expect(within(fieldRow('tags')).getByText('["a","b"]')).toBeTruthy()
		expect(within(fieldRow('_score')).getByText('1.5')).toBeTruthy()
	})

	it('labels a field that is already a column as removable', () => {
		render(RowDetail, props)
		expect(within(fieldRow('title')).getByRole('button').textContent.trim()).toBe(
			'Remove'
		)
		expect(within(fieldRow('user.name')).getByRole('button').textContent.trim()).toBe(
			'Add'
		)
	})

	it('toggles a column from a field row', async () => {
		const user = userEvent.setup()
		render(RowDetail, props)

		await user.click(within(fieldRow('user.name')).getByRole('button'))

		expect(props.onToggleColumn).toHaveBeenCalledWith('user.name')
	})

	it('shows the table view by default and reports a tab change', async () => {
		const user = userEvent.setup()
		render(RowDetail, props)

		expect(screen.getByText('_id', { selector: '.field-key' })).toBeTruthy()

		await user.click(screen.getByRole('button', { name: 'JSON View' }))
		expect(props.onTab).toHaveBeenCalledWith('json')
	})

	it('renders the document as JSON when told to', () => {
		render(RowDetail, { ...props, tab: 'json' })

		expect(screen.getByText(/"title": "Alpha"/)).toBeTruthy()
		expect(screen.queryByText('_id', { selector: '.field-key' })).toBeNull()
	})

	it('hands the pretty-printed source to the copy handler', async () => {
		const user = userEvent.setup()
		render(RowDetail, props)

		await user.click(screen.getByRole('button', { name: /Copy JSON/ }))

		expect(props.onCopy).toHaveBeenCalledWith(
			JSON.stringify(hit._source, null, 2)
		)
	})

	it('lists a metadata name once when _source carries it too', () => {
		render(RowDetail, {
			...props,
			hit: { ...hit, _source: { ...hit._source, _id: 'inner' } },
		})

		const keys = screen
			.getAllByText(/.+/, { selector: '.field-key' })
			.map(node => node.textContent)

		expect(keys.filter(key => key === '_id')).toHaveLength(1)
		expect(within(fieldRow('_id')).getByText('abc')).toBeTruthy()
	})

	it('survives a hit with no _source', () => {
		render(RowDetail, { ...props, hit: { _index: 'logs', _id: 'abc' } })
		expect(screen.getByText('_id', { selector: '.field-key' })).toBeTruthy()
	})
})
