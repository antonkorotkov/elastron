<script>
	import { page } from '$app/stores'
	import { useStoreon } from '@storeon/svelte'
	import { isThemeToggleChecked } from '$lib/utils/helpers'
	import { resolve } from '$app/paths'

	let { rightContent } = $props()
	const { app } = useStoreon('app')
	let inverted = $derived(isThemeToggleChecked($app.theme))
</script>

<div class="ui pointing secondary menu" class:inverted>
	<a
		href={resolve('/monitoring/overview')}
		class="item"
		class:active={$page.url.pathname === '/monitoring/overview'}
	>
		Overview
	</a>
	<a
		href={resolve('/monitoring/nodes')}
		class="item"
		class:active={$page.url.pathname === '/monitoring/nodes'}
	>
		Nodes
	</a>

	{#if rightContent}
		<div class="right menu">
			{@render rightContent?.()}
		</div>
	{/if}
</div>

<style>
	.ui.menu {
		margin-top: 0;
	}
</style>
