<script>
	import { getContext } from 'svelte'
	import { useStoreon } from '@storeon/svelte'
	import { page } from '$app/stores'
	import { resolve } from '$app/paths'
	import OnlineIndicator from './OnlineIndicator.svelte'
	import { contrastTextColor } from '../utils/helpers'

	const onHeaderDblClick = () =>
		window.electron?.ipcRenderer?.send('header-doubleclick')

	const onDashboardClick = () =>
		window.electron?.ipcRenderer?.send('check-for-updates')

	const { open } = getContext('modal-window')

	const showConnectionDialog = async () => {
		const ConnectDialog = (
			await import('../components/modal/ConnectionDialog/ConnectDialog.svelte')
		).default

		dispatch('search/update', {
			view: 'hits',
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

	const { dispatch, connection, server } = useStoreon('connection', 'server')

	let version = $derived($server?.version || false)
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
			<button
				class="ui button item"
				onclick={showConnectionDialog}
				style="-webkit-app-region: no-drag;"
			>
				Connection
				<OnlineIndicator />
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
	.connection-strip {
		position: absolute;
		left: 0;
		right: 0;
		bottom: -4px;
		height: 4px;
	}
</style>
