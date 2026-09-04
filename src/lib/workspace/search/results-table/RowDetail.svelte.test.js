// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/svelte'
import { userEvent } from '@testing-library/user-event'
import { tick } from 'svelte'
import RowDetail from './RowDetail.svelte'
import {
	DETAIL_MAX_FIELDS,
	DETAIL_MAX_JSON_LINES,
} from '../../../utils/tableHelpers'

const hit = {
	_index: 'logs',
	_id: 'abc',
	_score: 1.5,
	_source: { title: 'Alpha', user: { name: 'Ada' }, tags: ['a', 'b'] },
}

/** A document with `count` top-level fields, each on its own JSON line pair. */
const wideHit = count => ({
	_index: 'logs',
	_id: 'wide',
	_score: 1,
	_source: Object.fromEntries(
		Array.from({ length: count }, (_, i) => [`field${i}`, `value${i}`])
	),
})

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

	describe('field list truncation', () => {
		it('shows no reveal control for a document within the field limit', () => {
			render(RowDetail, props)
			expect(screen.queryByText(/more field/)).toBeNull()
		})

		it('truncates the field list at the cap and states the hidden count', () => {
			const wide = wideHit(60)
			render(RowDetail, { ...props, hit: wide })

			// 3 metadata fields + 60 document fields = 63, capped at DETAIL_MAX_FIELDS.
			const total = 3 + 60
			const hidden = total - DETAIL_MAX_FIELDS

			const keys = screen
				.getAllByText(/.+/, { selector: '.field-key' })
				.map(node => node.textContent)
			expect(keys).toHaveLength(DETAIL_MAX_FIELDS)

			expect(
				screen.getByText(`Show ${hidden} more fields`)
			).toBeTruthy()
		})

		it('keeps metadata fields present when the document is truncated', () => {
			render(RowDetail, { ...props, hit: wideHit(60) })

			const keys = screen
				.getAllByText(/.+/, { selector: '.field-key' })
				.map(node => node.textContent)
			expect(keys).toEqual(expect.arrayContaining(['_id', '_index', '_score']))
		})

		it('reveals every field and hides the control once activated', async () => {
			const user = userEvent.setup()
			const wide = wideHit(60)
			render(RowDetail, { ...props, hit: wide })

			await user.click(screen.getByText(/more field/))
			await tick()

			const keys = screen
				.getAllByText(/.+/, { selector: '.field-key' })
				.map(node => node.textContent)
			expect(keys).toHaveLength(3 + 60)
			expect(screen.queryByText(/more field/)).toBeNull()
		})

		it('does not leak reveal state between rows', async () => {
			const user = userEvent.setup()
			const wideA = wideHit(60)
			const { unmount } = render(RowDetail, { ...props, hit: wideA })
			await user.click(screen.getByText(/more field/))
			await tick()
			expect(screen.queryByText(/more field/)).toBeNull()
			unmount()

			const wideB = wideHit(60)
			render(RowDetail, { ...props, hit: wideB })
			expect(screen.getByText(/more field/)).toBeTruthy()
		})

		it('returns to the truncated default when re-expanded (remounted)', () => {
			const wide = wideHit(60)
			const { unmount } = render(RowDetail, { ...props, hit: wide })
			unmount()

			render(RowDetail, { ...props, hit: wide })
			expect(screen.getByText(/more field/)).toBeTruthy()
		})
	})

	describe('JSON view truncation', () => {
		it('shows no reveal control for JSON within the line limit', () => {
			render(RowDetail, { ...props, tab: 'json' })
			expect(screen.queryByText(/more line/)).toBeNull()
		})

		it('truncates the JSON view at the line cap and states the hidden count', () => {
			const wide = wideHit(200)
			const fullJson = JSON.stringify(wide._source, null, 2)
			const totalLines = fullJson.split('\n').length
			const hidden = totalLines - DETAIL_MAX_JSON_LINES

			render(RowDetail, { ...props, hit: wide, tab: 'json' })

			expect(screen.getByText(`Show ${hidden} more lines`)).toBeTruthy()
			expect(screen.queryByText(/"field199"/)).toBeNull()
		})

		it('reveals the full JSON and hides the control once activated', async () => {
			const user = userEvent.setup()
			const wide = wideHit(200)
			render(RowDetail, { ...props, hit: wide, tab: 'json' })

			await user.click(screen.getByText(/more line/))
			await tick()

			expect(screen.getByText(/"field199"/)).toBeTruthy()
			expect(screen.queryByText(/more line/)).toBeNull()
		})

		it('always copies the complete source JSON, even while truncated', async () => {
			const user = userEvent.setup()
			const wide = wideHit(200)
			render(RowDetail, { ...props, hit: wide, tab: 'json' })

			await user.click(screen.getByRole('button', { name: /Copy JSON/ }))

			expect(props.onCopy).toHaveBeenCalledWith(
				JSON.stringify(wide._source, null, 2)
			)
		})

		it('keeps table and JSON reveal state independent for the same row', async () => {
			const user = userEvent.setup()
			const wide = wideHit(200)
			const { rerender } = render(RowDetail, { ...props, hit: wide, tab: 'table' })

			await user.click(screen.getByText(/more field/))
			await tick()
			expect(screen.queryByText(/more field/)).toBeNull()

			await rerender({ ...props, hit: wide, tab: 'json' })
			expect(screen.getByText(/more line/)).toBeTruthy()
		})
	})
})
