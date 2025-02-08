<script>

	import Query from './Query.svelte'
	import Collector from './Collector.svelte'
	import { useStoreon } from '@storeon/svelte'
	import { isThemeToggleChecked } from '../../../utils/helpers'
	let { search } = $props();

	const { app } = useStoreon('app')

	let inverted = $derived(isThemeToggleChecked($app.theme))
</script>

<div class="profile-table__search">
	{#if search.query && search.query.length}
		<h5 class="ui header" class:inverted>Search Queries</h5>
		{#if search.rewrite_time}
			<small class="ui label">Rewrite Time: {search.rewrite_time}</small>
		{/if}
		<div class="ui fluid accordion styled" class:inverted>
			{#each search.query as query, i}
				<Query {query} queries={search.query} />
			{/each}
		</div>
	{/if}
	{#if search.collector && search.collector.length}
		<h5 class="ui header" class:inverted>Search Collectors</h5>
		<div class="ui fluid accordion styled" class:inverted>
			{#each search.collector as collector, i}
				<Collector {collector} collectors={search.collector} />
			{/each}
		</div>
	{/if}
</div>

<style>
	.ui.accordion.styled.inverted {
		background-color: #222;
	}
</style>
