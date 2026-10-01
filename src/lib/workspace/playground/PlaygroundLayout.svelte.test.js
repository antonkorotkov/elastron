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
	},
	selectedIndex: null,
	responseBody: null,
	responseMeta: null,
	responseView: 'json',
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
			const memoryKeys = [
				'selectedIndex',
				'responseBody',
				'responseMeta',
				'responseView',
				'isRequestLoading',
			]
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

const clusterResponse = (statusCode, statusText, body, contentType = 'application/json') => ({
	statusCode,
	statusText,
	contentType,
	body,
})

const genericRequest = vi.fn(async () => clusterResponse(200, 'OK', { took: 1 }))

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

		resolveRequest(clusterResponse(200, 'OK', { took: 1, hits: {} }))
		await tick()

		expect(get(playgroundStore).responseBody).toBeNull()
		expect(get(playgroundStore).responseMeta).toBeNull()
		expect(get(playgroundStore).isRequestLoading).toBe(false)
	})
})

describe('PlaygroundLayout response pane', () => {
	beforeEach(() => {
		playgroundStore.set(defaultPlaygroundState())
		stores.connection.set({ id: 'c1', version: '8.0.0' })
		dispatch.mockClear()
		genericRequest.mockReset()
	})

	const send = async answer => {
		genericRequest.mockImplementationOnce(answer)
		await fireEvent.click(screen.getByText('Send'))
		for (let i = 0; i < 5; i++) await tick()
	}

	const tab = name => screen.getByRole('button', { name })
	const isShown = el => el.closest('.editor-wrapper').style.display === 'block'
	const badge = () => screen.queryByTestId('response-status')
	const notified = () => dispatch.mock.calls.some(([event]) => event === 'notification/add')

	it('shows no status badge before a request is sent', async () => {
		await renderPlayground()

		expect(badge()).toBeNull()
		expect(screen.queryByText('No response')).toBeNull()
	})

	it('opens a JSON response in the JSON view with a success badge', async () => {
		await renderPlayground()

		await send(async () => clusterResponse(200, 'OK', { status: 'green' }))

		expect(tab('JSON').classList.contains('active')).toBe(true)
		expect(get(playgroundStore).responseBody).toEqual({ status: 'green' })
		expect(badge().textContent).toMatch(/^200 OK · \d+ ms$/)
		expect(badge().classList.contains('green')).toBe(true)
	})

	it('shows a JSON response as pretty-printed text in the Raw view', async () => {
		await renderPlayground()
		await send(async () => clusterResponse(200, 'OK', { status: 'green' }))

		await fireEvent.click(tab('Raw'))

		const raw = screen.getByTestId('raw-response')
		expect(isShown(raw)).toBe(true)
		expect(raw.textContent).toBe('{\n  "status": "green"\n}')
	})

	it('opens a text response in the Raw view with JSON unavailable', async () => {
		await renderPlayground()
		const table = 'health status index\ngreen  open   logs\n'

		await send(async () => clusterResponse(200, 'OK', table, 'text/plain; charset=UTF-8'))

		const raw = screen.getByTestId('raw-response')
		expect(isShown(raw)).toBe(true)
		expect(raw.textContent).toBe(table)
		expect(tab('Raw').classList.contains('active')).toBe(true)
		expect(tab('JSON').disabled).toBe(true)
		expect(tab('JSON').title).toBe('Response is not JSON')
	})

	it('selects the fitting view for each new response', async () => {
		await renderPlayground()
		await send(async () => clusterResponse(200, 'OK', { a: 1 }))
		await fireEvent.click(tab('Raw'))

		await send(async () => clusterResponse(200, 'OK', { b: 2 }))

		expect(tab('JSON').classList.contains('active')).toBe(true)
	})

	it('shows a cluster error response in full without a notification', async () => {
		await renderPlayground()
		const body = { error: { root_cause: [{ reason: 'no such index [nope]' }] }, status: 404 }

		await send(async () => clusterResponse(404, 'Not Found', body))

		expect(notified()).toBe(false)
		expect(get(playgroundStore).responseBody).toEqual(body)
		expect(tab('JSON').classList.contains('active')).toBe(true)
		expect(badge().textContent).toMatch(/^404 Not Found · \d+ ms$/)
		expect(badge().classList.contains('orange')).toBe(true)
	})

	it('styles a server error response as an error', async () => {
		await renderPlayground()

		await send(async () => clusterResponse(500, 'Internal Server Error', { error: 'boom' }))

		expect(notified()).toBe(false)
		expect(badge().classList.contains('red')).toBe(true)
	})

	it('shows a HEAD result as text and replaces the previous response', async () => {
		await renderPlayground()
		await send(async () => clusterResponse(200, 'OK', 'previous\n', 'text/plain'))

		await send(async () => clusterResponse(404, 'Not Found', false, ''))

		expect(screen.getByTestId('raw-response').textContent).toBe('false')
		expect(badge().textContent).toMatch(/^404 Not Found/)
	})

	it('shows an empty text response instead of the previous one', async () => {
		await renderPlayground()
		await send(async () => clusterResponse(200, 'OK', 'previous\n', 'text/plain'))

		await send(async () => clusterResponse(200, 'OK', '', 'text/plain'))

		expect(screen.queryByTestId('raw-response')).toBeNull()
		expect(isShown(screen.getByText('Empty response'))).toBe(true)
	})

	it('reports a request that got no cluster response', async () => {
		await renderPlayground()
		await send(async () => clusterResponse(200, 'OK', { a: 1 }))

		await send(async () => {
			throw Object.assign(new Error('The cluster could not be reached (ConnectionError).'), {
				unreachable: true,
			})
		})

		expect(dispatch).toHaveBeenCalledWith('notification/add', {
			type: 'error',
			message: 'The cluster could not be reached (ConnectionError).',
		})
		expect(screen.getByText('No response')).toBeTruthy()
		expect(badge()).toBeNull()
		expect(get(playgroundStore).responseBody).toBeNull()
	})

	it('reports a failure that is not about reaching the cluster without a badge', async () => {
		await renderPlayground()
		await send(async () => clusterResponse(200, 'OK', { a: 1 }))

		await send(async () => {
			throw new Error('Invalid JSON payload')
		})

		expect(dispatch).toHaveBeenCalledWith('notification/add', {
			type: 'error',
			message: 'Invalid JSON payload',
		})
		expect(screen.queryByText('No response')).toBeNull()
		expect(badge()).toBeNull()
		expect(get(playgroundStore).responseBody).toBeNull()
	})

	it('keeps the latest response when an earlier request finishes last', async () => {
		await renderPlayground()
		const pending = []
		genericRequest.mockImplementation(() => new Promise(resolve => pending.push(resolve)))

		await fireEvent.click(screen.getByText('Send'))
		await fireEvent.click(screen.getByText('Send'))
		await tick()

		pending[1](clusterResponse(200, 'OK', { latest: true }))
		for (let i = 0; i < 5; i++) await tick()
		expect(get(playgroundStore).isRequestLoading).toBe(false)

		pending[0](clusterResponse(404, 'Not Found', { earlier: true }))
		for (let i = 0; i < 5; i++) await tick()

		expect(get(playgroundStore).responseBody).toEqual({ latest: true })
		expect(badge().textContent).toMatch(/^200 OK/)
	})

	it('keeps loading until the latest request finishes', async () => {
		await renderPlayground()
		const pending = []
		genericRequest.mockImplementation(() => new Promise(resolve => pending.push(resolve)))

		await fireEvent.click(screen.getByText('Send'))
		await fireEvent.click(screen.getByText('Send'))
		await tick()

		pending[0](clusterResponse(200, 'OK', { earlier: true }))
		for (let i = 0; i < 5; i++) await tick()

		expect(get(playgroundStore).isRequestLoading).toBe(true)
		expect(get(playgroundStore).responseBody).toBeNull()
	})
})

describe('PlaygroundLayout request headers', () => {
	beforeEach(() => {
		playgroundStore.set(defaultPlaygroundState())
		stores.connection.set({ id: 'c1', version: '8.0.0' })
		genericRequest.mockReset()
		genericRequest.mockImplementation(async () => clusterResponse(200, 'OK', {}))
	})

	it('offers no way to set request headers', async () => {
		await renderPlayground()

		expect(screen.queryByRole('button', { name: 'Headers' })).toBeNull()
	})

	it('sends no request headers, even from a draft saved with some', async () => {
		playgroundStore.set({
			...defaultPlaygroundState(),
			draft: {
				...defaultPlaygroundState().draft,
				headers: [{ key: 'X-Opaque-Id', value: 'abc', enabled: true }],
			},
		})
		await renderPlayground()

		await fireEvent.click(screen.getByText('Send'))
		await tick()

		expect(genericRequest).toHaveBeenCalledWith(expect.not.objectContaining({ headers: expect.anything() }))
	})
})
