// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/svelte'
import { tick } from 'svelte'
import { userEvent } from '@testing-library/user-event'
import { writable } from 'svelte/store'
import SearchTabs from './SearchTabs.svelte'
import { createTab, MAX_TABS } from '../../store/search'

const dispatch = vi.fn()
const searchStore = writable({ tabs: [], activeId: null })

vi.mock('@storeon/svelte', () => ({
	useStoreon: () => ({
		app: writable({ theme: 'light' }),
		search: searchStore,
		dispatch,
	}),
}))

const setup = (tabs, activeId = tabs[0]?.id) => {
	searchStore.set({ tabs, activeId })
	return render(SearchTabs)
}

const tabButtons = () => screen.getAllByRole('tab')

describe('SearchTabs', () => {
	beforeEach(() => {
		dispatch.mockReset()
	})

	it('shows one tab per search, titled by index unless named', () => {
		setup([
			createTab({ id: 'a', index: 'logs' }),
			createTab({ id: 'b', index: 'products', title: 'Recent orders' }),
		])

		expect(tabButtons().map(t => t.textContent.trim())).toEqual([
			'logs',
			'Recent orders',
		])
		expect(tabButtons()[0].getAttribute('aria-selected')).toBe('true')
		expect(tabButtons()[1].getAttribute('aria-selected')).toBe('false')
	})

	it('switches to a clicked tab', async () => {
		const user = userEvent.setup()
		setup([createTab({ id: 'a' }), createTab({ id: 'b', index: 'other' })])

		await user.click(screen.getByRole('tab', { name: 'other' }))

		expect(dispatch).toHaveBeenCalledWith('search/tabs/switch', 'b')
	})

	it('closes a tab from its close control', async () => {
		const user = userEvent.setup()
		setup([createTab({ id: 'a', index: 'logs' }), createTab({ id: 'b' })])

		await user.click(screen.getByRole('button', { name: 'Close tab logs' }))

		expect(dispatch).toHaveBeenCalledWith('search/tabs/close', 'a')
		expect(dispatch).not.toHaveBeenCalledWith('search/tabs/switch', 'a')
	})

	it('adds a tab', async () => {
		const user = userEvent.setup()
		setup([createTab({ id: 'a' })])

		await user.click(screen.getByRole('button', { name: 'New tab' }))

		expect(dispatch).toHaveBeenCalledWith('search/tabs/add')
	})

	it('still asks the store to add at the cap, which is where the refusal lives', async () => {
		const user = userEvent.setup()
		setup(Array.from({ length: MAX_TABS }, (_, i) => createTab({ id: `t${i}` })))

		await user.click(screen.getByRole('button', { name: 'New tab' }))

		expect(dispatch).toHaveBeenCalledWith('search/tabs/add')
	})

	it('scrolls the active tab into view when it changes', async () => {
		const scrollIntoView = vi.fn()
		Element.prototype.scrollIntoView = scrollIntoView
		const tabs = [
			createTab({ id: 'a' }),
			createTab({ id: 'b', index: 'far' }),
			createTab({ id: 'c' }),
		]
		setup(tabs, 'a')
		scrollIntoView.mockClear()

		searchStore.set({ tabs, activeId: 'b' })
		await tick()

		expect(scrollIntoView).toHaveBeenCalledTimes(1)
		const target = scrollIntoView.mock.instances[0]
		expect(target.classList.contains('item')).toBe(true)
		expect(target.querySelector('[role="tab"]').textContent.trim()).toBe('far')
	})

	it('reveals the add control when the last tab becomes active', async () => {
		const scrollIntoView = vi.fn()
		Element.prototype.scrollIntoView = scrollIntoView
		const tabs = [createTab({ id: 'a' }), createTab({ id: 'b' })]
		setup(tabs, 'a')
		scrollIntoView.mockClear()

		searchStore.set({ tabs, activeId: 'b' })
		await tick()

		expect(scrollIntoView.mock.instances[0].classList.contains('add')).toBe(true)
	})

	it('marks a tab whose query is running', () => {
		setup([createTab({ id: 'a', index: 'logs', loading: true })])

		expect(screen.getByLabelText('Running')).toBeTruthy()
	})

	it('renames on double click and commits with Enter', async () => {
		const user = userEvent.setup()
		setup([createTab({ id: 'a', index: 'logs' })])

		await user.dblClick(screen.getByRole('tab', { name: 'logs' }))
		const input = screen.getByLabelText('Tab name')
		await user.clear(input)
		await user.type(input, 'Errors today{Enter}')

		expect(dispatch).toHaveBeenCalledWith('search/tabs/rename', {
			id: 'a',
			title: 'Errors today',
		})
		expect(screen.queryByLabelText('Tab name')).toBeNull()
	})

	it('commits a rename on blur', async () => {
		const user = userEvent.setup()
		setup([createTab({ id: 'a', index: 'logs' })])

		await user.dblClick(screen.getByRole('tab', { name: 'logs' }))
		const input = screen.getByLabelText('Tab name')
		await user.type(input, 'Named')
		await fireEvent.blur(input)

		expect(dispatch).toHaveBeenCalledWith('search/tabs/rename', {
			id: 'a',
			title: 'Named',
		})
	})

	it('abandons a rename on Escape', async () => {
		const user = userEvent.setup()
		setup([createTab({ id: 'a', index: 'logs' })])

		await user.dblClick(screen.getByRole('tab', { name: 'logs' }))
		await user.type(screen.getByLabelText('Tab name'), 'Nope{Escape}')

		expect(dispatch).not.toHaveBeenCalledWith(
			'search/tabs/rename',
			expect.anything()
		)
		expect(screen.getByRole('tab', { name: 'logs' })).toBeTruthy()
	})

	it('starts the rename from the custom title, not the index', async () => {
		const user = userEvent.setup()
		setup([createTab({ id: 'a', index: 'logs', title: 'Named' })])

		await user.dblClick(screen.getByRole('tab', { name: 'Named' }))

		expect(screen.getByLabelText('Tab name').value).toBe('Named')
	})
})
