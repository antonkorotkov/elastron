// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/svelte'
import { userEvent } from '@testing-library/user-event'
import ColumnsSidebar from './ColumnsSidebar.svelte'

const handlers = () => ({
	onToggle: vi.fn(),
	onMove: vi.fn(),
	onRename: vi.fn(),
	onReset: vi.fn(),
})

const columns = [
	{ field: 'title', name: 'Title' },
	{ field: 'views', name: 'views' },
]

const availableFields = ['_id', '_index', 'title', 'views', 'author', 'body']

describe('ColumnsSidebar', () => {
	let props

	beforeEach(() => {
		props = { columns, availableFields, ...handlers() }
	})

	it('lists the selected columns with a count', () => {
		render(ColumnsSidebar, props)
		expect(screen.getByText('Selected (2)')).toBeTruthy()
		expect(screen.getByText('Title')).toBeTruthy()
		// A renamed column keeps its field path visible.
		expect(screen.getByText('(title)')).toBeTruthy()
	})

	it('offers only fields that are not already columns', () => {
		render(ColumnsSidebar, props)
		expect(screen.getByTitle('Add author as a column')).toBeTruthy()
		expect(screen.queryByTitle('Add title as a column')).toBeNull()
	})

	it('filters the available fields as you type', async () => {
		const user = userEvent.setup()
		render(ColumnsSidebar, props)

		await user.type(screen.getByLabelText('Filter fields'), 'aut')

		expect(screen.getByTitle('Add author as a column')).toBeTruthy()
		expect(screen.queryByTitle('Add body as a column')).toBeNull()
	})

	it('reports when a filter matches nothing', async () => {
		const user = userEvent.setup()
		render(ColumnsSidebar, props)

		await user.type(screen.getByLabelText('Filter fields'), 'zzz')

		expect(screen.getByText('No fields found')).toBeTruthy()
	})

	it('shows a loader instead of the field list while the mapping loads', () => {
		render(ColumnsSidebar, { ...props, loading: true })
		expect(screen.queryByTitle('Add author as a column')).toBeNull()
	})

	it('adds a field when it is clicked', async () => {
		const user = userEvent.setup()
		render(ColumnsSidebar, props)

		await user.click(screen.getByTitle('Add author as a column'))

		expect(props.onToggle).toHaveBeenCalledWith('author')
	})

	it('removes a column', async () => {
		const user = userEvent.setup()
		render(ColumnsSidebar, props)

		await user.click(screen.getByLabelText('Remove column title'))

		expect(props.onToggle).toHaveBeenCalledWith('title')
	})

	it('moves a column and disables the moves that would fall off the ends', async () => {
		const user = userEvent.setup()
		render(ColumnsSidebar, props)

		expect(screen.getByLabelText('Move column title up').disabled).toBe(true)
		expect(screen.getByLabelText('Move column views down').disabled).toBe(true)

		await user.click(screen.getByLabelText('Move column title down'))
		expect(props.onMove).toHaveBeenCalledWith(0, 1)
	})

	it('resets the layout', async () => {
		const user = userEvent.setup()
		render(ColumnsSidebar, props)

		await user.click(screen.getByRole('button', { name: /Reset/ }))

		expect(props.onReset).toHaveBeenCalled()
	})

	describe('renaming', () => {
		const startRename = async user => {
			await user.click(screen.getByLabelText('Rename column title'))
			return screen.getByLabelText('New name for column title')
		}

		it('commits a rename on Enter exactly once', async () => {
			const user = userEvent.setup()
			render(ColumnsSidebar, props)

			const input = await startRename(user)
			await user.clear(input)
			await user.type(input, 'Headline{Enter}')

			// Committing unmounts the input, which fires its own blur — the
			// guard keeps that from dispatching a second identical save.
			expect(props.onRename).toHaveBeenCalledTimes(1)
			expect(props.onRename).toHaveBeenCalledWith('title', 'Headline')
		})

		it('commits a rename when the input loses focus', async () => {
			const user = userEvent.setup()
			render(ColumnsSidebar, props)

			const input = await startRename(user)
			await user.clear(input)
			await user.type(input, 'Headline')
			await user.tab()

			expect(props.onRename).toHaveBeenCalledTimes(1)
			expect(props.onRename).toHaveBeenCalledWith('title', 'Headline')
		})

		it('abandons the rename on Escape', async () => {
			const user = userEvent.setup()
			render(ColumnsSidebar, props)

			const input = await startRename(user)
			await user.clear(input)
			await user.type(input, 'Headline{Escape}')

			expect(props.onRename).not.toHaveBeenCalled()
			expect(screen.getByText('Title')).toBeTruthy()
		})
	})
})
