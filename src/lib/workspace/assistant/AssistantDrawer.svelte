<script>
	import { getContext, untrack, tick } from 'svelte'
	import { useStoreon } from '@storeon/svelte'
	import { goto } from '$app/navigation'
	import { resolve } from '$app/paths'
	import { isThemeToggleChecked } from '../../utils/helpers'
	import { getActiveProviderConfig, isProviderUsable } from '../../store/aiSettings.js'
	import { findTab } from '../../store/search.js'
	import { formatRequestLine, pathWithQuery } from '../../ai/catalog.js'
	import { openSettingsDialog } from '../../components/modal/SettingsDialog/openSettings.js'
	import { createAssistantChat } from './createAssistantChat.js'
	import { isToolPart, errorMessageOf, prettyJson } from './format.js'
	import MessageText from './MessageText.svelte'
	import ToolPart from './ToolPart.svelte'
	import AiSparklesIcon from '../../components/icons/AiSparklesIcon.svelte'

	/** Injected by tests; the app uses the global fetch. */
	let { fetch = undefined } = $props()

	const { dispatch, assistant, aiSettings, connection, server, app, search } = useStoreon(
		'assistant',
		'aiSettings',
		'connection',
		'server',
		'app',
		'search'
	)
	const { open } = getContext('modal-window')

	let inverted = $derived(isThemeToggleChecked($app.theme))
	let provider = $derived(getActiveProviderConfig($aiSettings))
	let usable = $derived(isProviderUsable(provider))

	let draft = $state('')
	let confirmingClear = $state(false)
	let listElement = $state()

	// Read at send time so each request carries the current connection,
	// provider, and cluster, even if they changed since the chat was created.
	// These read the component's own subscriptions: @storeon/svelte keeps one
	// subscriber per key, so a one-off get() would silently unsubscribe them.
	const getRequestContext = () => ({
		connection: $connection,
		windowId: $app.windowId,
		provider: getActiveProviderConfig($aiSettings),
		cluster: { version: $server.version, flavor: $server.flavor },
	})

	// Each chat saves only while its endpoint is still the window's, so a reply
	// that finishes after a connection switch can't land in another cluster's
	// history. $state proxies can't be stored as-is; persist a plain copy.
	const persistFor = endpoint => messages => {
		if ($assistant.endpoint !== endpoint) return
		dispatch('assistant/setMessages', JSON.parse(JSON.stringify(messages)))
	}

	// Usage analytics count each message and the reply to it once. A reply
	// that continues after an approval belongs to the same message, so only
	// the first reply to finish after a send is reported.
	let awaitingReply = false
	const onReply = () => {
		if (!awaitingReply) return
		awaitingReply = false
		dispatch('assistant/responseReceived')
	}

	// One chat per endpoint, seeded with that endpoint's stored conversation.
	let chat = $state(null)
	let chatEndpoint = null
	$effect(() => {
		const endpoint = $assistant.endpoint
		if (chat && endpoint === chatEndpoint) return
		untrack(() => chat?.stop())
		chatEndpoint = endpoint
		const messages = untrack(() => $assistant.messages)
		chat = createAssistantChat({ messages, getRequestContext, onSettled: persistFor(endpoint), onReply, fetch })
	})

	let messages = $derived(chat?.messages ?? [])
	let busy = $derived(chat?.status === 'submitted' || chat?.status === 'streaming')

	const send = async () => {
		const text = draft.trim()
		if (!text || busy || !usable || !chat) return
		draft = ''
		awaitingReply = true
		dispatch('assistant/messageSent')
		await chat.sendMessage({ text })
	}

	const onKeydown = event => {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault()
			send()
		}
	}

	const respond = (part, approved) => chat?.addToolApprovalResponse({ id: part.approval.id, approved })

	const clearHistory = () => {
		chat?.stop()
		awaitingReply = false
		dispatch('assistant/clear')
		if (chat) chat.messages = []
		confirmingClear = false
	}

	const openInSearch = proposal => {
		const id = globalThis.crypto?.randomUUID?.() ?? `assistant-${Date.now()}`
		const { q, size, from, sort } = proposal.querystring ?? {}
		dispatch(
			'search/tabs/add',
			proposal.mode === 'uri'
				? {
						id,
						type: 'uri',
						index: proposal.index,
						uriQuery: q || '*',
						...(size !== undefined ? { size: Number(size) } : {}),
						...(from !== undefined ? { from: Number(from) } : {}),
						...(sort !== undefined ? { sort } : {}),
					}
				: {
						id,
						type: 'body',
						index: proposal.index,
						requestBody: proposal.body ?? { query: { match_all: {} } },
					}
		)
		// At the tab limit the search store refuses and says why; stay put.
		if (findTab($search, id)) goto(resolve('/search'))
	}

	const loadInPlayground = proposal => {
		dispatch('playground/loadTemplate', {
			name: proposal.title || 'Assistant query',
			method: proposal.method,
			// The Playground has one URL field, so parameters go on the path.
			path: pathWithQuery(proposal),
			body: proposal.body ?? {},
			headers: [],
		})
		goto(resolve('/playground'))
	}

	const copy = async proposal => {
		const text =
			proposal.body === undefined
				? formatRequestLine(proposal)
				: `${formatRequestLine(proposal)}\n${prettyJson(proposal.body)}`
		try {
			await navigator.clipboard.writeText(text)
			dispatch('notification/add', { type: 'success', message: 'Copied the query to the clipboard' })
		} catch (error) {
			dispatch('notification/add', { type: 'error', message: `Could not copy: ${error.message}` })
		}
	}

	const handoff = { onOpenInSearch: openInSearch, onLoadInPlayground: loadInPlayground, onCopy: copy }

	// Follow new content while the user is reading the end of the conversation.
	$effect(() => {
		const last = messages.at(-1)
		void last?.parts?.length
		void JSON.stringify(last?.parts?.at(-1) ?? null).length
		void chat?.status
		if (!listElement) return
		const nearBottom = listElement.scrollHeight - listElement.scrollTop - listElement.clientHeight < 80
		if (nearBottom) tick().then(() => listElement && (listElement.scrollTop = listElement.scrollHeight))
	})
</script>

<aside
	class="assistant-drawer"
	class:inverted
	class:open={$assistant.open}
	aria-label="Assistant"
	aria-hidden={!$assistant.open}
>
	<div class="drawer-header">
		<h3><AiSparklesIcon class="title-icon" /> Assistant</h3>
		<div class="header-actions">
			{#if confirmingClear}
				<span class="confirm-clear">
					Clear this conversation?
					<button type="button" class="ui mini red button" onclick={clearHistory}>Clear</button>
					<button type="button" class="ui mini basic button" class:inverted onclick={() => (confirmingClear = false)}>Cancel</button>
				</span>
			{:else}
				<button
					type="button"
					class="ui mini basic icon button"
					class:inverted
					aria-label="Clear history"
					title="Clear history"
					disabled={!messages.length}
					onclick={() => (confirmingClear = true)}
				>
					<i class="trash alternate icon"></i>
				</button>
			{/if}
			<button
				type="button"
				class="ui mini basic icon button"
				class:inverted
				aria-label="Close assistant"
				title="Close"
				onclick={() => dispatch('assistant/close')}
			>
				<i class="times icon"></i>
			</button>
		</div>
	</div>

	<div class="message-list" bind:this={listElement} aria-live="polite">
		{#if !messages.length}
			<div class="empty-state">
				<p>Ask about the connected cluster, or have the assistant build a query.</p>
				<p class="examples">"Which indices are the largest?"<br />"Find error logs from the last hour."</p>
			</div>
		{/if}

		{#each messages as message (message.id)}
			<div class="message {message.role}">
				{#each message.parts as part, i (i)}
					{#if part.type === 'text'}
						{#if message.role === 'user'}
							<p class="user-text">{part.text}</p>
						{:else}
							<MessageText text={part.text} />
						{/if}
					{:else if isToolPart(part)}
						<ToolPart {part} onRespond={respond} {handoff} {inverted} />
					{/if}
				{/each}
			</div>
		{/each}

		{#if chat?.status === 'submitted'}
			<p class="thinking"><i class="notched circle loading icon"></i> Thinking…</p>
		{/if}

		{#if chat?.error}
			<div class="ui small negative message chat-error" role="alert">
				<p>{errorMessageOf(chat.error)}</p>
				<button type="button" class="ui mini button" onclick={() => chat.regenerate()}>Retry</button>
				<button type="button" class="ui mini basic button" onclick={() => chat.clearError()}>Dismiss</button>
			</div>
		{/if}
	</div>

	<div class="composer">
		{#if !usable}
			<div class="configure" role="note">
				<p>Choose an AI provider and enter its API key and model to use the assistant.</p>
				<button type="button" class="ui small primary button" onclick={() => openSettingsDialog(open, 'ai')}>
					Open AI settings
				</button>
			</div>
		{:else}
			<form class="ui form" class:inverted onsubmit={event => (event.preventDefault(), send())}>
				<textarea
					rows="3"
					placeholder="Ask the assistant…"
					aria-label="Message"
					bind:value={draft}
					onkeydown={onKeydown}
				></textarea>
				<div class="composer-actions">
					{#if busy}
						<button type="button" class="ui small button" class:inverted onclick={() => chat.stop()}>
							<i class="stop icon"></i> Stop
						</button>
					{:else}
						<button type="submit" class="ui small primary button" disabled={!draft.trim()}>
							<i class="paper plane icon"></i> Send
						</button>
					{/if}
				</div>
			</form>
		{/if}
	</div>
</aside>

<style>
	/* Shared by the cards and code blocks inside the drawer. */
	.assistant-drawer {
		--assistant-border: rgba(34, 36, 38, 0.15);
		--assistant-divider: rgba(34, 36, 38, 0.1);
		--assistant-code-bg: rgba(0, 0, 0, 0.05);
		--assistant-danger: #db2828;
		--assistant-link: #4183c4;
		position: fixed;
		top: 4rem;
		right: 0;
		bottom: 0;
		width: var(--assistant-width, 440px);
		z-index: 90;
		display: none;
		flex-direction: column;
		background: #fff;
		border-left: 1px solid rgba(34, 36, 38, 0.15);
		box-shadow: -2px 0 10px rgba(0, 0, 0, 0.06);
	}
	.assistant-drawer.open {
		display: flex;
	}
	.assistant-drawer.inverted {
		--assistant-border: rgba(255, 255, 255, 0.2);
		--assistant-divider: rgba(255, 255, 255, 0.12);
		--assistant-code-bg: rgba(255, 255, 255, 0.07);
		--assistant-danger: #ff695e;
		--assistant-link: #7cb8ee;
		background: #1b1c1d;
		color: rgba(255, 255, 255, 0.9);
		border-left-color: rgba(255, 255, 255, 0.1);
	}
	.drawer-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.75rem 1rem;
		border-bottom: 1px solid var(--assistant-divider);
	}
	.drawer-header h3 {
		margin: 0;
		font-size: 1.1rem;
	}
	/* Logo yellow on the dark panel only; on white it would all but vanish. */
	.assistant-drawer.inverted .drawer-header :global(.ai-sparkles) {
		color: #fff000;
	}
	.header-actions {
		display: flex;
		align-items: center;
		gap: 0.25rem;
	}
	.confirm-clear {
		font-size: 0.9em;
	}
	.message-list {
		flex: 1;
		overflow-y: auto;
		padding: 1rem;
	}
	.message {
		margin-bottom: 1rem;
	}
	.message.user {
		display: flex;
		justify-content: flex-end;
	}
	.user-text {
		max-width: 85%;
		margin: 0;
		padding: 0.5em 0.75em;
		border-radius: 8px;
		background: #2185d0;
		color: #fff;
		white-space: pre-wrap;
		word-break: break-word;
	}
	.empty-state {
		opacity: 0.7;
		text-align: center;
		margin-top: 2rem;
	}
	.examples {
		font-style: italic;
	}
	.thinking {
		opacity: 0.7;
	}
	.chat-error p {
		margin-bottom: 0.5em;
	}
	.composer {
		padding: 0.75rem 1rem;
		border-top: 1px solid var(--assistant-divider);
	}
	.composer textarea {
		resize: none;
	}
	.composer-actions {
		display: flex;
		justify-content: flex-end;
		margin-top: 0.5rem;
	}
	.configure p {
		margin-bottom: 0.5em;
	}
</style>
