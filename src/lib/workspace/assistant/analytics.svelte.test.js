// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte'
import { createStoreon } from 'storeon'
import AssistantDrawer from './AssistantDrawer.svelte'
import SettingsDialog from '../../components/modal/SettingsDialog/SettingsDialog.svelte'
import { app } from '../../store/app.js'
import { connection } from '../../store/connection.js'
import { server } from '../../store/server.js'
import { aiSettings } from '../../store/aiSettings.js'
import { assistant } from '../../store/assistant.js'
import { search } from '../../store/search.js'
import { playground } from '../../store/playground.js'
import { notifications } from '../../store/notifications.js'
import { analytics } from '../../store/analytics.js'

// Analytics is switched on for this test: a measurement ID and a gtag global.
vi.mock('$env/static/public', () => ({ PUBLIC_GA_ID: 'G-TEST' }))

const holder = vi.hoisted(() => ({ store: null }))

vi.mock('svelte', async importOriginal => ({
	...(await importOriginal()),
	getContext: key =>
		typeof key === 'symbol' && key.description === 'storeon'
			? holder.store
			: { open: vi.fn(), close: vi.fn() },
}))
vi.mock('$app/navigation', () => ({ goto: vi.fn() }))
vi.mock('$app/paths', () => ({ resolve: path => path }))

const sse = chunks =>
	new Response(chunks.map(c => `data: ${JSON.stringify(c)}\n\n`).join('') + 'data: [DONE]\n\n', {
		headers: { 'content-type': 'text/event-stream', 'x-vercel-ai-ui-message-stream': 'v1' },
	})

const frame = inner => [{ type: 'start' }, { type: 'start-step' }, ...inner, { type: 'finish-step' }, { type: 'finish' }]

describe('assistant and analytics', () => {
	beforeEach(() => {
		window.gtag = vi.fn()
	})

	it('reports one sent and one received event, without content, across configuring, chatting, approving, and handing off', async () => {
		holder.store = createStoreon([app, connection, server, aiSettings, assistant, search, playground, notifications, analytics])
		const { store } = holder
		store.dispatch('app/hydrate', { windowId: 'win-1' })
		store.dispatch('connection/update', { host: 'http://es.local', port: '9200' })
		store.dispatch('connected', { version: '9.1.0', flavor: 'default' })
		store.dispatch('assistant/loaded', { endpoint: 'http://es.local|9200|', messages: [] })

		// Connecting sends its own event; everything after this is the assistant.
		expect(window.gtag).toHaveBeenCalledWith('event', 'cluster_connected', { es_version: '9.1.0', es_flavor: 'default' })
		window.gtag.mockClear()

		store.dispatch('aiSettings/hydrate', null)
		const settings = render(SettingsDialog)
		await fireEvent.change(screen.getByLabelText('Active provider'), { target: { value: 'openai' } })
		await fireEvent.input(document.getElementById('ai-openai-api-key'), { target: { value: 'sk-openai' } })
		await fireEvent.input(document.getElementById('ai-openai-model'), { target: { value: 'gpt-5.1' } })
		await fireEvent.click(screen.getByRole('button', { name: 'Save' }))
		settings.unmount()

		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(sse(frame([
				{ type: 'tool-input-available', toolCallId: 'c1', toolName: 'delete-index', input: { index: 'old' } },
				{ type: 'tool-approval-request', approvalId: 'a1', toolCallId: 'c1' },
			])))
			.mockResolvedValueOnce(sse(frame([
				{ type: 'tool-input-available', toolCallId: 'c2', toolName: 'propose-query', input: {} },
				{ type: 'tool-output-available', toolCallId: 'c2', output: { kind: 'search', index: 'logs', method: 'POST', path: '/logs/_search', body: { query: { match_all: {} } } } },
			])))
		store.dispatch('assistant/open')
		render(AssistantDrawer, { fetch: fetchMock })

		await fireEvent.input(screen.getByLabelText('Message'), { target: { value: 'delete old, then show logs' } })
		await fireEvent.click(screen.getByRole('button', { name: /Send/ }))
		await fireEvent.click(await screen.findByRole('button', { name: 'Approve' }))
		await fireEvent.click(await screen.findByRole('button', { name: /Open in Search/ }))
		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))

		// The continuation after the approval belongs to the same message, so
		// it doesn't produce a second received event.
		expect(window.gtag.mock.calls).toEqual([
			['event', 'assistant_message_sent', {}],
			['event', 'assistant_response_received', {}],
		])
		expect(JSON.stringify(window.gtag.mock.calls)).not.toMatch(/sk-openai|gpt-5\.1|openai|delete|logs|old/)
	})

	it('sends no received event for a failed reply, and one after a successful retry', async () => {
		holder.store = createStoreon([app, connection, server, aiSettings, assistant, search, playground, notifications, analytics])
		const { store } = holder
		store.dispatch('connection/update', { host: 'http://es.local', port: '9200' })
		store.dispatch('assistant/loaded', { endpoint: 'http://es.local|9200|', messages: [] })
		store.dispatch('aiSettings/save', { activeProvider: 'openai', providers: { openai: { apiKey: 'sk-openai', model: 'gpt-5.1' } } })
		store.dispatch('assistant/open')

		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(new Response(JSON.stringify({ error: 'The provider rejected the API key.' }), { status: 400 }))
			.mockResolvedValueOnce(sse(frame([
				{ type: 'text-start', id: 't' },
				{ type: 'text-delta', id: 't', delta: 'Hello.' },
				{ type: 'text-end', id: 't' },
			])))
		render(AssistantDrawer, { fetch: fetchMock })

		await fireEvent.input(screen.getByLabelText('Message'), { target: { value: 'hi' } })
		await fireEvent.click(screen.getByRole('button', { name: /Send/ }))
		await screen.findByRole('alert')
		expect(window.gtag.mock.calls).toEqual([['event', 'assistant_message_sent', {}]])

		await fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
		await screen.findByText('Hello.')
		await waitFor(() => expect(window.gtag).toHaveBeenCalledTimes(2))
		expect(window.gtag.mock.calls[1]).toEqual(['event', 'assistant_response_received', {}])
	})
})
