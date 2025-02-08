<script>

	import { useStoreon } from '@storeon/svelte'
	import { isThemeToggleChecked } from '../../../utils/helpers'
	import Query from './Query.svelte'
	let { aggregations } = $props();

	const { app } = useStoreon('app')

	let inverted = $derived(isThemeToggleChecked($app.theme))
</script>

{#if aggregations && aggregations.length}
	<h5 class="ui header" class:inverted>Aggregations</h5>
	<div class="ui fluid accordion styled" class:inverted>
		{#each aggregations as query, i}
			<Query {query} queries={aggregations} />
		{/each}
	</div>
{/if}

<style>
	.ui.accordion.styled.inverted {
		background-color: #333;
	}
</style>
