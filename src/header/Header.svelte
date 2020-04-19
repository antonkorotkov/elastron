<script>
	import { getContext } from 'svelte'
	import { useStoreon } from '@storeon/svelte'
  import { routerKey } from '@storeon/router'

	import ConnectionDialog from '../components/modal/ConnectionDialog/ConnectionDialog.svelte'

	const { open } = getContext('modal-window')

  const showConnectionDialog = () => {
		open(
			ConnectionDialog
		)
	}

	const { [routerKey]: route } = useStoreon(routerKey)
</script>

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
</style>

<header>
  <div style="-webkit-app-region: drag" class="ui menu inverted fixed">
		<div class="logo item">
			<b>Elastron</b>
		</div>
		<a class="item" href="/" class:active={$route.match.page == 'dashboard'}>
			Dashboard
		</a>
		<a class="item" href="/search" class:active={$route.match.page == 'search'}>
			Search
		</a>
		<a class="item" href="/mapping" class:active={$route.match.page == 'mapping'}>
			Mapping
		</a>
		<a class="item right" on:click={showConnectionDialog} href="javascript:void(0);">
			Connection
		</a>
	</div>
</header>