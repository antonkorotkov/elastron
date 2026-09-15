// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte'
import { createStoreon } from 'storeon'
import { tick } from 'svelte'
import AssistantDrawer from './AssistantDrawer.svelte'
import { app } from '../../store/app.js'
import { connection } from '../../store/connection.js'
import { server } from '../../store/server.js'
import { aiSettings } from '../../store/aiSettings.js'
import { assistant } from '../../store/assistant.js'
import { search, MAX_TABS } from '../../store/search.js'
import { playground } from '../../store/playground.js'
import { notifications } from '../../store/notifications.js'

const holder = vi.hoisted(() => ({ store: null, open: null, goto: null }))

// The real @storeon/svelte adapter is used, so the tests share its
// one-subscriber-per-key behavior. Its store comes from the same getContext
// the modal context does.
vi.mock('svelte', async importOriginal => ({
	...(await importOriginal()),
	getContext: key =>
		typeof key === 'symbol' && key.description === 'storeon'
			? holder.store
			: { open: (...args) => holder.open(...args), close: vi.fn() },
}))

vi.mock('$app/navigation', () => ({ goto: (...args) => holder.goto(...args) }))
vi.mock('$app/paths', () => ({ resolve: path => path }))

// A fake /api/ai/chat that answers with UI message stream chunks.
const sse = chunks =>
	new Response(
		chunks.map(chunk => `data: ${JSON.stringify(chunk)}\n\n`).join('') + 'data: [DONE]\n\n',
		{ headers: { 'content-type': 'text/event-stream', 'x-vercel-ai-ui-message-stream': 'v1' } }
	)

const textReply = text => [
	{ type: 'start', messageId: `m-${text}` },
	{ type: 'start-step' },
	{ type: 'text-start', id: 't' },
	{ type: 'text-delta', id: 't', delta: text },
	{ type: 'text-end', id: 't' },
	{ type: 'finish-step' },
	{ type: 'finish' },
]

const toolReply = (toolName, input, extra) => [
	{ type: 'start', messageId: `m-${toolName}` },
	{ type: 'start-step' },
	{ type: 'tool-input-available', toolCallId: 'call-1', toolName, input },
	...extra,
	{ type: 'finish-step' },
	{ type: 'finish' },
]

const frameParts = inner => [{ type: 'start' }, { type: 'start-step' }, ...inner, { type: 'finish-step' }, { type: 'finish' }]

const approvalReply = (toolName, input) =>
	toolReply(toolName, input, [{ type: 'tool-approval-request', approvalId: 'approval-1', toolCallId: 'call-1' }])

const proposalReply = output =>
	toolReply('propose-query', output, [{ type: 'tool-output-available', toolCallId: 'call-1', output }])

let fetchMock
const bodies = () => fetchMock.mock.calls.map(([, init]) => JSON.parse(init.body))

const configure = () => {
	holder.store.dispatch('aiSettings/save', {
		activeProvider: 'anthropic',
		providers: { anthropic: { apiKey: 'sk-ant', model: 'claude-opus-5' } },
	})
}

const setup = ({ configured = true } = {}) => {
	holder.store = createStoreon([app, connection, server, aiSettings, assistant, search, playground, notifications])
	holder.open = vi.fn()
	holder.goto = vi.fn()
	const { store } = holder
	store.dispatch('app/hydrate', { windowId: 'win-1' })
	store.dispatch('connection/update', { host: 'http://es.local', port: '9200', useAuth: false })
	store.dispatch('server/update', { version: '9.1.0' })
	store.dispatch('connected', { version: '9.1.0', flavor: 'default' })
	store.dispatch('assistant/loaded', { endpoint: 'http://es.local|9200|', messages: [] })
	if (configured) configure()
	store.dispatch('assistant/open')
	fetchMock = vi.fn()
	render(AssistantDrawer, { fetch: fetchMock })
}

const typeAndSend = async text => {
	const box = screen.getByLabelText('Message')
	await fireEvent.input(box, { target: { value: text } })
	await fireEvent.click(screen.getByRole('button', { name: /Send/ }))
}

const drawer = () => document.querySelector('.assistant-drawer')

describe('AssistantDrawer', () => {
	beforeEach(() => {
		global.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ data: [] }) }))
	})

	describe('panel', () => {
		it('opens and closes from the store', async () => {
			setup()
			expect(drawer().classList.contains('open')).toBe(true)
			await fireEvent.click(screen.getByRole('button', { name: 'Close assistant' }))
			expect(holder.store.get().assistant.open).toBe(false)
			await tick()
			expect(drawer().classList.contains('open')).toBe(false)
			holder.store.dispatch('assistant/toggle')
			await tick()
			expect(drawer().classList.contains('open')).toBe(true)
		})

		it('stays open when a handoff navigates to another page', async () => {
			setup()
			fetchMock.mockResolvedValueOnce(sse(proposalReply({ kind: 'request', method: 'GET', path: '/_cat/nodes' })))
			await typeAndSend('nodes')
			await fireEvent.click(await screen.findByRole('button', { name: /Load in Playground/ }))
			expect(holder.goto).toHaveBeenCalledWith('/playground')
			expect(holder.store.get().assistant.open).toBe(true)
		})
	})

	describe('chatting', () => {
		it('sends the conversation with the connection, provider, and cluster, and renders the streamed reply', async () => {
			setup()
			fetchMock.mockResolvedValueOnce(sse(textReply('There are 3 indices.')))
			await typeAndSend('How many indices?')

			expect(await screen.findByText('There are 3 indices.')).toBeTruthy()
			const [url] = fetchMock.mock.calls[0]
			expect(url).toBe('/api/ai/chat')
			const body = bodies()[0]
			expect(body.messages.at(-1).parts[0].text).toBe('How many indices?')
			expect(body.connection.host).toBe('http://es.local')
			expect(body.windowId).toBe('win-1')
			expect(body.provider).toEqual({ provider: 'anthropic', apiKey: 'sk-ant', model: 'claude-opus-5' })
			expect(body.cluster).toEqual({ version: '9.1.0', flavor: 'default' })
		})

		it('persists the conversation when a reply ends', async () => {
			setup()
			fetchMock.mockResolvedValueOnce(sse(textReply('Done.')))
			await typeAndSend('hi')
			await screen.findByText('Done.')
			await waitFor(() => expect(holder.store.get().assistant.messages).toHaveLength(2))
			expect(holder.store.get().assistant.messages[1].role).toBe('assistant')
		})

		it('restores the stored conversation', async () => {
			holder.store = null
			setup()
			holder.store.dispatch('assistant/setMessages', [])
			expect(screen.getByText(/Ask about the connected cluster/)).toBeTruthy()
		})
	})

	describe('tool failures', () => {
		it('mutes an invalid tool input the model is sent back to fix', async () => {
			setup()
			fetchMock.mockResolvedValueOnce(sse([
				{ type: 'start' },
				{ type: 'start-step' },
				{ type: 'tool-input-error', toolCallId: 'bad-1', toolName: 'propose-query', input: { kind: 'search' }, errorText: 'Invalid input for tool propose-query: Type validation failed' },
				{ type: 'finish-step' },
				{ type: 'start-step' },
				{ type: 'text-start', id: 't' },
				{ type: 'text-delta', id: 't', delta: 'Fixed it.' },
				{ type: 'text-end', id: 't' },
				{ type: 'finish-step' },
				{ type: 'finish' },
			]))
			await typeAndSend('find errors')
			await screen.findByText('Fixed it.')

			const line = document.querySelector('.tool-line.rejected')
			expect(line.textContent).toContain('Propose query: invalid request, sent back to the assistant')
			expect(line.open).toBe(false)
			expect(document.querySelector('.tool-line.failed')).toBeNull()
			expect(screen.queryByText(/Could not prepare the query/)).toBeNull()
		})

		it('mutes a refused write input instead of showing a failed approval card', async () => {
			setup()
			fetchMock.mockResolvedValueOnce(sse(frameParts([
				{ type: 'tool-input-error', toolCallId: 'bad-2', toolName: 'delete-index', input: { index: '_all' }, errorText: 'Invalid input for tool delete-index: Name one index.' },
			])))
			await typeAndSend('delete everything')
			await waitFor(() => expect(document.querySelector('.tool-line.rejected')).toBeTruthy())
			expect(screen.queryByRole('group', { name: 'Delete index approval' })).toBeNull()
			expect(screen.queryByRole('button', { name: 'Approve' })).toBeNull()
		})

		it('still shows an Elasticsearch failure in red', async () => {
			setup()
			fetchMock.mockResolvedValueOnce(sse(toolReply('get-mapping', { index: 'nope' }, [
				{ type: 'tool-output-error', toolCallId: 'call-1', errorText: 'no such index [nope]' },
			])))
			await typeAndSend('mapping of nope')
			await waitFor(() => expect(document.querySelector('.tool-line.failed')).toBeTruthy())
			expect(document.querySelector('.tool-line.failed').textContent).toContain('Get mapping')
			expect(document.querySelector('.tool-line.rejected')).toBeNull()
		})
	})

	describe('switching clusters', () => {
		it('shows the other cluster history and never saves an old reply into it', async () => {
			setup()
			let finishOldReply
			fetchMock.mockReturnValueOnce(new Promise(resolve => (finishOldReply = resolve)))
			await typeAndSend('slow question')

			holder.store.dispatch('connection/update', { host: 'http://es.other' })
			holder.store.dispatch('assistant/loaded', { endpoint: 'http://es.other|9200|', messages: [] })
			await tick()
			expect(screen.queryByText('slow question')).toBeNull()

			finishOldReply(sse(textReply('Late answer.')))
			await new Promise(resolve => setTimeout(resolve, 20))
			expect(holder.store.get().assistant.endpoint).toBe('http://es.other|9200|')
			expect(holder.store.get().assistant.messages).toEqual([])
		})
	})

	describe('unconfigured provider', () => {
		it('asks for a provider instead of offering the message box', () => {
			setup({ configured: false })
			expect(screen.queryByLabelText('Message')).toBeNull()
			expect(screen.getByText(/Choose an AI provider/)).toBeTruthy()
		})

		it('links straight to the AI Integration settings', async () => {
			setup({ configured: false })
			await fireEvent.click(screen.getByRole('button', { name: 'Open AI settings' }))
			await waitFor(() => expect(holder.open).toHaveBeenCalled())
			expect(holder.open.mock.calls[0][1]).toEqual({ initialSection: 'ai' })
		})
	})

	describe('errors', () => {
		it('shows a provider error as a distinct message and keeps unsent text', async () => {
			setup()
			fetchMock.mockResolvedValueOnce(
				new Response(JSON.stringify({ error: 'The provider rejected the API key. (401)' }), { status: 400 })
			)
			await typeAndSend('hello')
			const alert = await screen.findByRole('alert')
			expect(alert.textContent).toContain('The provider rejected the API key.')

			const box = screen.getByLabelText('Message')
			await fireEvent.input(box, { target: { value: 'my next question' } })
			await tick()
			expect(screen.getByLabelText('Message').value).toBe('my next question')
			expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy()
		})
	})

	describe('approval card', () => {
		it('shows the exact request for a destructive write', async () => {
			setup()
			fetchMock.mockResolvedValueOnce(sse(approvalReply('delete-index', { index: 'logs-2024' })))
			await typeAndSend('delete logs-2024')

			const card = await screen.findByRole('group', { name: 'Delete index approval' })
			expect(card.textContent).toContain('DELETE /logs-2024')
			expect(card.textContent).toContain('This cannot be undone.')
			expect(card.classList.contains('destructive')).toBe(true)
		})

		it('asks before sending a later page of the index list', async () => {
			setup()
			fetchMock.mockResolvedValueOnce(sse(approvalReply('list-indices', { sort: 'store.size:desc', page: 2 })))
			await typeAndSend('show me the next page')

			const card = await screen.findByRole('group', { name: 'List indices approval' })
			expect(card.textContent).toContain('Page 2: entries 51–100. Approving sends them to the AI provider.')
			expect(card.textContent).toContain('GET /_cat/indices?format=json')
			expect(card.classList.contains('destructive')).toBe(false)
			expect(screen.getByRole('button', { name: 'Approve' }).classList.contains('green')).toBe(true)
		})

		it('sends the approval back and continues when approved', async () => {
			setup()
			fetchMock
				.mockResolvedValueOnce(sse(approvalReply('delete-index', { index: 'logs-2024' })))
				.mockResolvedValueOnce(sse(textReply('Deleted logs-2024.')))
			await typeAndSend('delete logs-2024')
			await fireEvent.click(await screen.findByRole('button', { name: 'Approve' }))

			expect(await screen.findByText('Deleted logs-2024.')).toBeTruthy()
			const part = bodies()[1].messages.at(-1).parts.find(p => p.type === 'tool-delete-index')
			expect(part.approval).toMatchObject({ id: 'approval-1', approved: true })
		})

		it('sends a decline back and makes no cluster request from the renderer', async () => {
			setup()
			fetchMock
				.mockResolvedValueOnce(sse(approvalReply('wipe-index', { index: 'logs' })))
				.mockResolvedValueOnce(sse(textReply('Okay, I left it alone.')))
			await typeAndSend('wipe logs')
			await fireEvent.click(await screen.findByRole('button', { name: 'Decline' }))

			await screen.findByText('Okay, I left it alone.')
			const part = bodies()[1].messages.at(-1).parts.find(p => p.type === 'tool-wipe-index')
			expect(part.approval).toMatchObject({ id: 'approval-1', approved: false })
			expect(fetchMock.mock.calls.every(([url]) => url === '/api/ai/chat')).toBe(true)
			expect(global.fetch).not.toHaveBeenCalled()
		})
	})

	describe('query handoff', () => {
		const searchProposal = { kind: 'search', title: 'Errors', index: 'logs', method: 'POST', path: '/logs/_search', body: { query: { term: { level: 'error' } } } }
		const requestProposal = { kind: 'request', method: 'PUT', path: '/logs/_mapping', body: { properties: { level: { type: 'keyword' } } } }

		it('offers Open in Search only for search proposals', async () => {
			setup()
			fetchMock.mockResolvedValueOnce(sse(proposalReply(requestProposal)))
			await typeAndSend('mapping')
			await screen.findByRole('group', { name: 'Proposed query' })
			expect(screen.queryByRole('button', { name: /Open in Search/ })).toBeNull()
			expect(screen.getByRole('button', { name: /Load in Playground/ })).toBeTruthy()
			expect(screen.getByRole('button', { name: /Copy/ })).toBeTruthy()
		})

		it('opens a search proposal in a new tab without running it', async () => {
			setup()
			const tabsBefore = holder.store.get().search.tabs.length
			fetchMock.mockResolvedValueOnce(sse(proposalReply(searchProposal)))
			await typeAndSend('errors')
			await fireEvent.click(await screen.findByRole('button', { name: /Open in Search/ }))

			const { tabs, activeId } = holder.store.get().search
			const tab = tabs.find(t => t.id === activeId)
			expect(tabs).toHaveLength(tabsBefore + 1)
			expect(tab).toMatchObject({ type: 'body', index: 'logs', requestBody: searchProposal.body })
			expect(tab.loading).toBeFalsy()
			expect(holder.goto).toHaveBeenCalledWith('/search')
			expect(global.fetch).not.toHaveBeenCalled()
		})

		it('opens a proposed URI search in the Search view URI mode', async () => {
			setup()
			const q = 'DataEntry_SubmittedAt:[2026-09-01T00:00:00Z TO 2026-10-01T00:00:00Z}'
			fetchMock.mockResolvedValueOnce(sse(proposalReply({
				kind: 'search', mode: 'uri', title: 'September entries', index: 'form_de_v16_*', method: 'GET', path: '/form_de_v16_*/_search',
				querystring: { q, size: '50', sort: 'DataEntry_SubmittedAt:asc' },
			})))
			await typeAndSend('entries submitted in September')

			const card = await screen.findByRole('group', { name: 'Proposed query' })
			expect(card.textContent).toContain('GET /form_de_v16_*/_search?q=DataEntry_SubmittedAt:')
			await fireEvent.click(screen.getByRole('button', { name: /Open in Search/ }))

			const { tabs, activeId } = holder.store.get().search
			expect(tabs.find(t => t.id === activeId)).toMatchObject({
				type: 'uri', index: 'form_de_v16_*', uriQuery: q, size: 50, sort: 'DataEntry_SubmittedAt:asc',
			})
			expect(holder.goto).toHaveBeenCalledWith('/search')
		})

		it('refuses at the search tab limit and stays in place', async () => {
			setup()
			while (holder.store.get().search.tabs.length < MAX_TABS) holder.store.dispatch('search/tabs/add')
			fetchMock.mockResolvedValueOnce(sse(proposalReply(searchProposal)))
			await typeAndSend('errors')
			await fireEvent.click(await screen.findByRole('button', { name: /Open in Search/ }))

			expect(holder.store.get().search.tabs).toHaveLength(MAX_TABS)
			expect(holder.goto).not.toHaveBeenCalled()
			expect(holder.store.get().notifications.at(-1).message).toMatch(/at most 20 search tabs/)
		})

		it('carries query parameters on the card, into the Playground, and to Copy', async () => {
			setup()
			const writeText = vi.fn(async () => {})
			Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
			fetchMock.mockResolvedValueOnce(sse(proposalReply({
				kind: 'request',
				title: 'List indices sorted by size (largest first)',
				method: 'GET',
				path: '/_cat/indices',
				querystring: { v: '', s: 'store.size:desc', bytes: 'mb' },
			})))
			await typeAndSend('can you append ?v&s=store.size:desc&bytes=mb to the url for me?')

			const card = await screen.findByRole('group', { name: 'Proposed query' })
			expect(card.textContent).toContain('GET /_cat/indices?v&s=store.size:desc&bytes=mb')
			expect(card.textContent).not.toContain('null')

			await fireEvent.click(screen.getByRole('button', { name: /Copy/ }))
			expect(writeText).toHaveBeenCalledWith('GET /_cat/indices?v&s=store.size:desc&bytes=mb')

			await fireEvent.click(screen.getByRole('button', { name: /Load in Playground/ }))
			expect(holder.store.get().playground.draft.path).toBe('/_cat/indices?v&s=store.size:desc&bytes=mb')
		})

		it('loads a proposal into the Playground draft', async () => {
			setup()
			fetchMock.mockResolvedValueOnce(sse(proposalReply(requestProposal)))
			await typeAndSend('mapping')
			await fireEvent.click(await screen.findByRole('button', { name: /Load in Playground/ }))

			const { draft } = holder.store.get().playground
			expect(draft.method).toBe('PUT')
			expect(draft.path).toBe('/logs/_mapping')
			expect(JSON.parse(draft.bodyText)).toEqual(requestProposal.body)
			expect(holder.goto).toHaveBeenCalledWith('/playground')
		})
	})

	describe('themes', () => {
		it('uses the sparkles icon in the title', () => {
			setup()
			expect(document.querySelector('.drawer-header svg.ai-sparkles')).toBeTruthy()
		})

		it('keeps neutral buttons plain in light mode', async () => {
			setup()
			fetchMock.mockResolvedValueOnce(sse(approvalReply('delete-index', { index: 'old' })))
			await typeAndSend('delete old')
			await screen.findByRole('button', { name: 'Decline' })
			expect(drawer().classList.contains('inverted')).toBe(false)
			expect(screen.getByRole('button', { name: 'Decline' }).classList.contains('inverted')).toBe(false)
		})

		it('inverts the drawer and its neutral buttons in dark mode, keeping Approve solid', async () => {
			setup()
			holder.store.dispatch('app/toggleTheme', 'dark')
			fetchMock
				.mockResolvedValueOnce(sse(approvalReply('delete-index', { index: 'old' })))
				.mockResolvedValueOnce(sse(proposalReply({ kind: 'search', index: 'logs', method: 'POST', path: '/logs/_search', body: {} })))
			await typeAndSend('delete old')
			await screen.findByRole('button', { name: 'Decline' })
			// The card appears mid-stream; Send returns once the reply ends.
			await fireEvent.input(screen.getByLabelText('Message'), { target: { value: 'query' } })
			await fireEvent.click(await screen.findByRole('button', { name: /Send/ }))
			await screen.findByRole('button', { name: /Copy/ })

			expect(drawer().classList.contains('inverted')).toBe(true)
			for (const name of ['Decline', 'Clear history', 'Close assistant']) {
				expect(screen.getByRole('button', { name }).classList.contains('inverted')).toBe(true)
			}
			expect(screen.getByRole('button', { name: /Copy/ }).classList.contains('inverted')).toBe(true)
			expect(screen.getByRole('button', { name: /Load in Playground/ }).classList.contains('inverted')).toBe(true)
			expect(screen.getByRole('button', { name: 'Approve' }).classList.contains('inverted')).toBe(false)
		})
	})

	describe('clearing history', () => {
		it('asks first, then empties the conversation', async () => {
			setup()
			fetchMock.mockResolvedValueOnce(sse(textReply('Hello there.')))
			await typeAndSend('hi')
			await screen.findByText('Hello there.')

			await fireEvent.click(screen.getByRole('button', { name: 'Clear history' }))
			await fireEvent.click(screen.getByRole('button', { name: 'Clear' }))
			expect(holder.store.get().assistant.messages).toEqual([])
			await tick()
			expect(screen.queryByText('Hello there.')).toBeNull()
		})
	})
})
