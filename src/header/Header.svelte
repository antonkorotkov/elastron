<script>
	import { getContext } from 'svelte'
	import { useStoreon } from '@storeon/svelte'
	import { routerKey } from '@storeon/router'
	import get from 'lodash/get'

	import ConnectionDialog from '../components/modal/ConnectionDialog/ConnectionDialog.svelte'
	import OnlineIndicator from './OnlineIndicator.svelte'
	import messenger from '../api/ipc-renderer'

	const onHeaderDblClick = () => messenger.send('header-doubleclick')

	const onDashboardClick = () => messenger.send('check-for-updates')

	const { open } = getContext('modal-window')

	const showConnectionDialog = () => {
		dispatch('search/update', {
			view: 'hits',
		})
		open(
			ConnectionDialog,
			{},
			{
				closeOnEsc: false,
				closeOnOuterClick: false,
			}
		)
	}

	const {
		dispatch,
		[routerKey]: route,
		connection,
		server,
	} = useStoreon(routerKey, 'connection', 'server')

	let version = $derived(get($server, 'version.number', false))
</script>

<header ondblclick={onHeaderDblClick} role="navigation">
	<div class="ui menu inverted fixed">
		<div class="logo item" style="-webkit-app-region: drag;">
			<b style="cursor: move;">Elastron</b>
		</div>
		<a
			class="item"
			href="/"
			class:active={$route.match.page == 'dashboard'}
			onclick={onDashboardClick}
		>
			Dashboard
		</a>
		<a class="item" href="/search" class:active={$route.match.page == 'search'}>
			Search
		</a>
		<a
			class="item"
			href="/import-export"
			class:active={$route.match.page == 'import-export'}
		>
			Import/Export
			<sup>beta</sup>
		</a>
		<div class="right menu">
			{#if $connection.name}
				<span class="item">{$connection.name}</span>
			{/if}
			{#if version}
				<span class="item" title="ElasticSearch version">v{version}</span>
			{/if}
			<a class="item" onclick={showConnectionDialog} href>
				Connection
				<OnlineIndicator />
			</a>
		</div>
	</div>
</header>

<style>
	.logo {
		border-radius: 0 !important;
		padding-left: 6rem !important;
		background-color: #fff000 !important;
	}
	.logo b {
		color: #000;
	}
	header {
		height: 4rem;
	}
	sup {
		color: red;
	}
</style>
