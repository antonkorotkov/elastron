<script>
	import { page } from '$app/stores'
	import { useStoreon } from '@storeon/svelte'
	import { isThemeToggleChecked } from '$lib/utils/helpers'
	import { resolve } from '$app/paths'

	const { app } = useStoreon('app')
	let inverted = $derived(isThemeToggleChecked($app.theme))
</script>

<div class="ui pointing secondary menu" class:inverted>
	<a href={resolve('/')} class="item" class:active={$page.url.pathname === '/'}>
		Indices
	</a>
	<a
		href={resolve('/shards')}
		class="item"
		class:active={$page.url.pathname === '/shards'}
	>
		Shards
	</a>
	<a
		href={resolve('/allocation')}
		class="item"
		class:active={$page.url.pathname === '/allocation'}
	>
		Allocation
	</a>
</div>

<style>
	.ui.menu {
		margin-top: 0;
	}
</style>
