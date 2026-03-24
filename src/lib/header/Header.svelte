<script>
	import { getContext } from 'svelte'
	import { useStoreon } from '@storeon/svelte'
	import { page } from '$app/stores'
	import { resolve } from '$app/paths'
	import get from 'lodash/get'

	import ConnectDialog from '../components/modal/ConnectionDialog/ConnectDialog.svelte'
	import OnlineIndicator from './OnlineIndicator.svelte'

	const onHeaderDblClick = () =>
		window.electron?.ipcRenderer?.send('header-doubleclick')

	const onDashboardClick = () =>
		window.electron?.ipcRenderer?.send('check-for-updates')

	const { open } = getContext('modal-window')

	const showConnectionDialog = () => {
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

	let version = $derived(get($server, 'version.number', false))
	let pathname = $derived($page.url.pathname)
</script>

<header ondblclick={onHeaderDblClick} role="navigation">
	<div class="ui borderless menu inverted fixed">
		<div class="logo item" style="-webkit-app-region: drag;">
			<b style="cursor: move;">Elastron</b>
		</div>
		<a
			class="item"
			href={resolve('/dashboard/indices')}
			class:active={pathname.startsWith('/dashboard')}
			onclick={onDashboardClick}
		>
			Dashboard
		</a>
		<a
			class="item"
			href={resolve('/search')}
			class:active={pathname === '/search'}
		>
			Search
		</a>

		<div class="right menu">
			{#if $connection.name}
				<span class="item">{$connection.name}</span>
			{/if}
			{#if version}
				<span class="item" title="ElasticSearch version">v{version}</span>
			{/if}
			<button class="ui button item" onclick={showConnectionDialog}>
				Connection
				<OnlineIndicator />
			</button>
		</div>
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
</style>
