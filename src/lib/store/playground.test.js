import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createStoreon } from 'storeon'
import { playground, flushPlaygroundDraft } from './playground'

const { setStorage } = vi.hoisted(() => ({ setStorage: vi.fn() }))

vi.mock('../utils/storage.js', () => ({
	setStorage,
	getStorage: vi.fn(),
}))

describe('playground store', () => {
	let store

	beforeEach(() => {
		setStorage.mockReset()
		flushPlaygroundDraft()
		store = createStoreon([playground])
	})

	const draft = () => store.get().playground.draft

	it('initializes with the default draft and in-memory fields', () => {
		expect(store.get().playground).toMatchObject({
			draft: {
				name: 'New Request',
				method: 'GET',
				path: '{{index}}/_search',
				bodyText: '{}',
				headers: [],
				activeTab: 'body',
			},
			selectedIndex: null,
			responseBody: {},
			isRequestLoading: false,
			isDrawerOpen: false,
		})
	})

	it('shallow-merges a patch into the draft, leaving other fields untouched', () => {
		store.dispatch('playground/update', { method: 'POST' })

		expect(draft()).toMatchObject({
			method: 'POST',
			path: '{{index}}/_search',
			headers: [],
		})
	})

	it('debounces the persisted write for a bodyText-only patch', () => {
		store.dispatch('playground/update', { bodyText: '{"a":1}' })

		expect(setStorage).not.toHaveBeenCalled()

		flushPlaygroundDraft()

		expect(setStorage).toHaveBeenCalledWith(
			'playground_draft',
			expect.objectContaining({ bodyText: '{"a":1}' })
		)
	})

	it('writes through immediately for a non-bodyText patch, flushing a pending body write first', () => {
		store.dispatch('playground/update', { bodyText: '{"a":1}' })
		store.dispatch('playground/update', { method: 'POST' })

		expect(setStorage).toHaveBeenCalledWith(
			'playground_draft',
			expect.objectContaining({ bodyText: '{"a":1}', method: 'POST' })
		)
	})

	it('does not persist selectedIndex, responseBody or isRequestLoading', () => {
		store.dispatch('playground/update', {
			selectedIndex: 'logs',
			responseBody: { took: 1 },
			isRequestLoading: true,
		})

		expect(setStorage).not.toHaveBeenCalled()
		expect(store.get().playground.selectedIndex).toBe('logs')
		expect(store.get().playground.responseBody).toEqual({ took: 1 })
		expect(store.get().playground.isRequestLoading).toBe(true)
	})

	it('merges a partial persisted draft over the defaults on hydrate', () => {
		store.dispatch('playground/hydrate', {
			templates: [],
			draft: { method: 'PUT', bodyText: '{"x":1}' },
		})

		expect(draft()).toMatchObject({
			method: 'PUT',
			bodyText: '{"x":1}',
			path: '{{index}}/_search',
			headers: [],
			activeTab: 'body',
		})
	})

	it('stringifies a loaded template body into bodyText', () => {
		store.dispatch('playground/loadTemplate', {
			name: 'Cluster Health',
			method: 'GET',
			path: '/_cluster/health',
			body: { a: 1 },
			headers: [],
		})

		expect(draft().bodyText).toBe(JSON.stringify({ a: 1 }, null, 2))
		expect(draft().method).toBe('GET')
		expect(draft().path).toBe('/_cluster/health')
	})

	it('saving a template sets draft.name without altering the working request', () => {
		store.dispatch('playground/update', {
			method: 'PUT',
			path: '/custom',
			bodyText: '{"q":1}',
			headers: [{ key: 'X', value: 'Y', enabled: true }],
		})

		store.dispatch('playground/saveTemplate', {
			name: 'My Template',
			method: 'PUT',
			path: '/custom',
			body: { q: 1 },
			headers: [{ key: 'X', value: 'Y', enabled: true }],
		})

		expect(draft()).toMatchObject({
			name: 'My Template',
			method: 'PUT',
			path: '/custom',
			bodyText: '{"q":1}',
			headers: [{ key: 'X', value: 'Y', enabled: true }],
		})
	})

	it('resets selectedIndex, responseBody and isRequestLoading on connected, keeping the draft', () => {
		store.dispatch('playground/update', {
			selectedIndex: 'logs',
			responseBody: { took: 1 },
			isRequestLoading: true,
			method: 'PUT',
			path: '/custom',
		})

		store.dispatch('connected')

		expect(store.get().playground.selectedIndex).toBeNull()
		expect(store.get().playground.responseBody).toEqual({})
		expect(store.get().playground.isRequestLoading).toBe(false)
		expect(draft()).toMatchObject({ method: 'PUT', path: '/custom' })
	})
})
