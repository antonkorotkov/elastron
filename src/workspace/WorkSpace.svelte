<script>
	import { useStoreon } from '@storeon/svelte'
	import { routerKey } from '@storeon/router'

	import Dashboard from './dashboard/Dashboard.svelte'
	import Search from './search/Search.svelte'
	import Index from './index/Index.svelte'
	import ImportExport from './import-export/Index.svelte'

	const { [routerKey]: route } = useStoreon(routerKey)

	let path = $derived($route.match.page ?? 'dashboard');
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
