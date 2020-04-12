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
	}
</style>

<header>
  <div class="ui menu inverted attached">
		<div class="active logo item yellow">
			<b>Elastron</b>
		</div>
		<a class="item" href="/" class:active={$route.match.page == 'dashboard'}>
			Dashboard
		</a>
		<a class="item" href="/mapping" class:active={$route.match.page == 'mapping'}>
			Mapping
		</a>
		<a class="item" href="/search" class:active={$route.match.page == 'search'}>
			Search
		</a>
		<a class="item right" on:click={showConnectionDialog} href="javascript:void(0);">
			Connection
		</a>
	</div>
</header>