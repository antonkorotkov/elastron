<script>
	import { useStoreon } from '@storeon/svelte'
	import { routerKey } from '@storeon/router'

	import Dashboard from '$lib/workspace/dashboard/Dashboard.svelte'
	import Search from '$lib/workspace/search/Search.svelte'
	import Index from '$lib/workspace/index/Index.svelte'
	import ImportExport from '$lib/workspace/import-export/Index.svelte'

	const { [routerKey]: route } = useStoreon(routerKey)

	$: path = $route.match.page ?? 'dashboard'
</script>

<div class="ui padded">
	{#if path === 'dashboard'}
		<Dashboard />
	{:else if path === 'index'}
		<Index />
	{:else if path === 'search'}
		<Search />
	{:else if path === 'import-export'}
		<ImportExport />
	{:else}
		<Dashboard />
	{/if}
</div>

<style>
	.padded {
		padding-left: 1rem;
		padding-right: 1rem;
		padding-bottom: 5rem;
	}
</style>
