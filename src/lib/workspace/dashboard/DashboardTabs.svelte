<script>
	import { page } from '$app/stores'
	import { useStoreon } from '@storeon/svelte'
	import { isThemeToggleChecked } from '$lib/utils/helpers'
	import { resolve } from '$app/paths'

	const { app } = useStoreon('app')
	let inverted = $derived(isThemeToggleChecked($app.theme))
</script>

<div class="ui pointing secondary menu" class:inverted>
	<a href={resolve('/dashboard/indices')} class="item" class:active={$page.url.pathname === '/dashboard/indices'}>
		Indices
	</a>
	<a
		href={resolve('/dashboard/shards')}
		class="item"
		class:active={$page.url.pathname === '/dashboard/shards'}
	>
		Shards
	</a>
	<a
		href={resolve('/dashboard/allocation')}
		class="item"
		class:active={$page.url.pathname === '/dashboard/allocation'}
	>
		Allocation
	</a>
</div>

<style>
	.ui.menu {
		margin-top: 0;
	}
</style>
