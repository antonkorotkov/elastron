<script>
	import { getContext } from 'svelte'
	import { useStoreon } from '@storeon/svelte'
	import { page } from '$app/stores'
	import { resolve } from '$app/paths'
	import { contrastTextColor } from '../utils/helpers'
	import { openSettingsDialog } from '../components/modal/SettingsDialog/openSettings.js'
	import AiSparklesIcon from '../components/icons/AiSparklesIcon.svelte'

	const onHeaderDblClick = () =>
		window.electron?.ipcRenderer?.send('header-doubleclick')

	const onDashboardClick = () =>
		window.electron?.ipcRenderer?.send('check-for-updates')

	const { open } = getContext('modal-window')

	const showConnectionDialog = async () => {
		const ConnectDialog = (
			await import('../components/modal/ConnectionDialog/ConnectDialog.svelte')
		).default

		// Leave the document editor before the connection can change under it.
		dispatch('search/update', {
			id: $search?.activeId,
			patch: { view: 'hits' },
		})

		open(
			ConnectDialog,
			{},
			{
				closeOnEsc: false,
				closeOnOuterClick: false,
			}
		)
	}

	const showSettingsDialog = () => openSettingsDialog(open)

	const { dispatch, connection, server, search, assistant } = useStoreon(
		'connection',
		'server',
		'search',
		'assistant'
	)

	let version = $derived($server?.version || false)
	let reachable = $derived(Boolean($server?.reachable))
	let pathname = $derived($page.url.pathname)
</script>

<header ondblclick={onHeaderDblClick} role="navigation">
	<div
		class="ui borderless menu inverted fixed"
		style="-webkit-app-region: drag;"
	>
		<div class="logo item">
			<b>Elastron</b>
		</div>
		<a
			class="item"
			href={resolve('/dashboard/indices')}
			class:active={pathname.startsWith('/dashboard')}
			onclick={onDashboardClick}
			style="-webkit-app-region: no-drag;"
		>
			Dashboard
		</a>
		<a
			class="item"
			href={resolve('/monitoring/overview')}
			class:active={pathname.startsWith('/monitoring')}
			style="-webkit-app-region: no-drag;"
		>
			Monitoring
		</a>
		<a
			class="item"
			href={resolve('/search')}
			class:active={pathname === '/search'}
			style="-webkit-app-region: no-drag;"
		>
			Search
		</a>
		<a
			class="item"
			href={resolve('/playground')}
			class:active={pathname.startsWith('/playground')}
			style="-webkit-app-region: no-drag;"
		>
			Playground
		</a>

		<div class="right menu">
			{#if $connection.name}
				<span class="item">
					{#if $connection.color}
						<span
							class="connection-pill"
							style="background: {$connection.color}; color: {contrastTextColor(
								$connection.color
							)};">{$connection.name}</span
						>
					{:else}
						{$connection.name}
					{/if}
				</span>
			{/if}
			{#if version}
				<span class="item" title="ElasticSearch version">v{version}</span>
			{/if}
			<!--
				A plain button rather than IconButton: IconButton toggles the
				green class on hover, which would repaint the status color.
			-->
			<button
				class="ui icon button item header-icon connection-button"
				onclick={showConnectionDialog}
				aria-label="Connection"
				title={reachable ? 'Connection: cluster reachable' : 'Connection: cluster unreachable'}
				style="-webkit-app-region: no-drag;"
			>
				<i class="plug icon" class:green={reachable} class:red={!reachable}></i>
			</button>
			<button
				class="ui icon button item header-icon assistant-button"
				class:active={$assistant?.open}
				onclick={() => dispatch('assistant/toggle')}
				aria-label="Assistant"
				aria-pressed={Boolean($assistant?.open)}
				title="Assistant"
				style="-webkit-app-region: no-drag;"
			>
				<AiSparklesIcon />
			</button>
			<button
				class="ui icon button item header-icon settings-button"
				onclick={showSettingsDialog}
				aria-label="Settings"
				title="Settings"
				style="-webkit-app-region: no-drag;"
			>
				<i class="cog icon"></i>
			</button>
		</div>

		<!--
			Sits just below the bar rather than inside it, so it reads across the
			full width without eating into the menu. The bar is `position: fixed`
			and so is already a containing block — this cannot shift layout, and
			the 4rem spacer on <header> stays correct.
		-->
		{#if $connection.color}
			<div
				class="connection-strip"
				style="background: {$connection.color};"
			></div>
		{/if}
	</div>
</header>

<style>
	.logo {
		border-radius: 0 !important;
		padding-left: 6rem !important;
		background-color: #fff000 !important;
		cursor: move;
	}
	.logo b {
		color: #000;
	}
	header {
		height: 4rem;
	}
	.connection-pill {
		display: inline-block;
		padding: 0.25rem 0.65rem;
		border-radius: 4px;
		font-weight: 700;
	}
	.header-icon {
		padding-left: 1em !important;
		padding-right: 1em !important;
	}
	.header-icon .icon {
		margin: 0 !important;
	}
	/* The same yellow as the logo, so the assistant reads as part of the brand. */
	.assistant-button :global(.ai-sparkles) {
		color: #fff000;
	}
	.connection-strip {
		position: absolute;
		left: 0;
		right: 0;
		bottom: -4px;
		height: 4px;
	}
</style>
