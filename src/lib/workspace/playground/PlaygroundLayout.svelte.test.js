// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent, screen } from '@testing-library/svelte'
import { tick } from 'svelte'
import { get, writable } from 'svelte/store'

const defaultPlaygroundState = () => ({
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
	builtinTemplates: [],
	customTemplates: [],
	isDrawerOpen: false,
})

const playgroundStore = writable(defaultPlaygroundState())

const stores = {
	connection: writable({ id: 'c1', version: '8.0.0' }),
	playground: playgroundStore,
	app: writable({ theme: 'light' }),
	indices: writable({ data: [], columns: [] }),
}

/**
 * A minimal stand-in for the real `playground/update` reducer, just enough
 * for the component's read-from-store-after-dispatch flow (e.g. sendRequest
 * reading `draft.bodyText`) to behave as it does against the real store.
 */
const dispatch = vi.fn((event, payload) => {
	if (event === 'playground/update') {
		playgroundStore.update(state => {
			const memoryKeys = ['selectedIndex', 'responseBody', 'isRequestLoading']
			const draftPatch = {}
			const memoryPatch = {}
			for (const key of Object.keys(payload)) {
				if (memoryKeys.includes(key)) memoryPatch[key] = payload[key]
				else draftPatch[key] = payload[key]
			}
			return {
				...state,
				...memoryPatch,
				draft: { ...state.draft, ...draftPatch },
			}
		})
	}
})

vi.mock('@storeon/svelte', () => ({
	useStoreon: (...keys) => {
		const out = { dispatch }
		for (const k of keys) out[k] = stores[k] || writable({})
		return out
	},
}))

const genericRequest = vi.fn(async () => ({ took: 1 }))

vi.mock('$lib/api/elasticsearch', () => ({
	default: class {
		constructor() {
			this.genericRequest = genericRequest
		}
	},
}))

const instances = []

vi.mock('jsoneditor', () => {
	class FakeEditor {
		constructor(container, options) {
			this.options = options
			this.text = '{}'
			this.update = vi.fn(json => {
				this.text = JSON.stringify(json, null, 2)
			})
			this.setText = vi.fn(text => {
				this.text = text
			})
			this.destroy = vi.fn()
			instances.push(this)
		}
		getText() {
			return this.text
		}
		get() {
			return JSON.parse(this.text)
		}
		/** Simulate the user typing in `code` mode. */
		type(text) {
			this.text = text
			this.options.onChangeText?.(text)
		}
	}
	return { default: FakeEditor }
})

const renderPlayground = async () => {
	instances.length = 0
	const { default: PlaygroundLayout } = await import('./PlaygroundLayout.svelte')
	const result = render(PlaygroundLayout)
	// JsonEditor dynamically imports jsoneditor in onMount.
	for (let i = 0; i < 20 && instances.length === 0; i++) await tick()
	await tick()
	return { ...result, requestEditor: instances[0] }
}

describe('PlaygroundLayout request body', () => {
	beforeEach(() => {
		playgroundStore.set(defaultPlaygroundState())
		stores.connection.set({ id: 'c1', version: '8.0.0' })
		dispatch.mockClear()
		genericRequest.mockClear()
	})

	it('leaves the editor text alone while the user types', async () => {
		const { requestEditor } = await renderPlayground()
		requestEditor.update.mockClear()

		// Several prefixes of this are valid JSON; re-applying any of them would
		// reformat the document and reset the cursor mid-typing.
		const target = '{"query":{"match_all":{}}}'
		for (let i = 1; i <= target.length; i++) {
			requestEditor.type(target.slice(0, i))
			await tick()
		}

		expect(requestEditor.update).not.toHaveBeenCalled()
		expect(requestEditor.getText()).toBe(target)
	})

	it('refuses to send malformed JSON', async () => {
		const { requestEditor } = await renderPlayground()
		requestEditor.type('{"query":')
		await tick()

		await fireEvent.click(screen.getByText('Send'))
		await tick()

		expect(genericRequest).not.toHaveBeenCalled()
		expect(dispatch).toHaveBeenCalledWith(
			'notification/add',
			expect.objectContaining({ type: 'error' })
		)
	})

	it('sends the parsed body once the JSON is valid', async () => {
		const { requestEditor } = await renderPlayground()
		requestEditor.type('{"query":{"match_all":{}}}')
		await tick()

		await fireEvent.click(screen.getByText('Send'))
		await tick()

		expect(genericRequest).toHaveBeenCalledWith(
			expect.objectContaining({
				method: 'GET',
				elasticBody: { query: { match_all: {} } },
			})
		)
	})

	it('replaces the editor contents when a template is loaded', async () => {
		const { requestEditor } = await renderPlayground()
		requestEditor.type('{"query":')
		await tick()
		requestEditor.setText.mockClear()

		const newBodyText = JSON.stringify({ query: { term: { a: 1 } } }, null, 2)
		playgroundStore.set({
			...defaultPlaygroundState(),
			draft: {
				...defaultPlaygroundState().draft,
				method: 'POST',
				path: '{{index}}/_count',
				bodyText: newBodyText,
			},
		})
		await tick()

		expect(requestEditor.setText).toHaveBeenCalledWith(newBodyText)
	})

	it('discards a response that arrives after the user switched connections', async () => {
		let resolveRequest
		genericRequest.mockImplementation(
			() => new Promise(resolve => { resolveRequest = resolve })
		)

		await renderPlayground()
		await fireEvent.click(screen.getByText('Send'))
		await tick()

		// Switch connections while the request is still in flight.
		stores.connection.set({ id: 'c2', version: '8.0.0' })
		await tick()

		resolveRequest({ took: 1, hits: {} })
		await tick()

		expect(get(playgroundStore).responseBody).toEqual({})
		expect(get(playgroundStore).isRequestLoading).toBe(false)
	})
})
