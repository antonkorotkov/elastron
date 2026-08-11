// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent, screen } from '@testing-library/svelte'
import { tick } from 'svelte'
import { writable } from 'svelte/store'

const playgroundStore = writable({
	currentRequest: {
		method: 'GET',
		path: '{{index}}/_search',
		body: {},
		headers: [],
	},
	builtinTemplates: [],
	customTemplates: [],
	isDrawerOpen: false,
})

const stores = {
	connection: writable({ id: 'c1', version: '8.0.0' }),
	playground: playgroundStore,
	app: writable({ theme: 'light' }),
	indices: writable({ data: [], columns: [] }),
}

const dispatch = vi.fn()

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
		requestEditor.update.mockClear()

		playgroundStore.set({
			currentRequest: {
				method: 'POST',
				path: '{{index}}/_count',
				body: { query: { term: { a: 1 } } },
				headers: [],
			},
			builtinTemplates: [],
			customTemplates: [],
			isDrawerOpen: false,
		})
		await tick()

		expect(requestEditor.update).toHaveBeenCalledWith({
			query: { term: { a: 1 } },
		})
	})
})
