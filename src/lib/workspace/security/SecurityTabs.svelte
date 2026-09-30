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
		href={resolve('/security/users')}
		class="item"
		class:active={$page.url.pathname === '/security/users'}
	>
		Users
	</a>
	<a
		href={resolve('/security/roles')}
		class="item"
		class:active={$page.url.pathname === '/security/roles'}
	>
		Roles
	</a>
	<a
		href={resolve('/security/api-keys')}
		class="item"
		class:active={$page.url.pathname === '/security/api-keys'}
	>
		API keys
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
