<script>
	import Query from './Query.svelte';
	import isEmpty from 'lodash/isEmpty'
	import { useStoreon } from '@storeon/svelte'
	import { isThemeToggleChecked } from '../../../utils/helpers'
	import profiling, { getTimeMillis, getTimeColor } from './'

	const { server, app } = useStoreon('server', 'app')

	let { query, queries } = $props();

	let active = $state(false)

	let inverted = $derived(isThemeToggleChecked($app.theme))

	let timeInNanos = $derived(profiling.query(query).getNanos($server.version.number))
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
<div
	class="title"
	class:inverted
	class:active
	onclick={() => (active = !active)}
	role="navigation"
>
	<i class="dropdown icon"></i>
	{profiling.query(query).getType($server.version.number)}
	<small class="ui label">
		{profiling.query(query).getDescription($server.version.number)}
	</small>
	<small
		class="ui label"
		style="background-color:{getTimeColor(
			timeInNanos,
			queries.map(q => profiling.query(q).getNanos($server.version.number))
		)}"
	>
		{getTimeMillis(timeInNanos || 0)}ms
	</small>
</div>
<div class="content" class:active>
	{#if !isEmpty(query.breakdown)}
		<div class="ui list">
			{#each Object.keys(query.breakdown) as i}
				<div class="item">
					<strong>{i}</strong>
					:
					<span class="ui label">{query.breakdown[i]}</span>
				</div>
			{/each}
		</div>
	{/if}
	{#if query.children && query.children.length}
		<div class="ui fluid accordion styled" class:inverted>
			{#each query.children as q, i}
				<Query query={q} queries={query.children} />
			{/each}
		</div>
	{/if}
</div>

<style>
	.title.inverted,
	.title.inverted:hover {
		color: white !important;
	}

	.ui.accordion.styled.inverted {
		background-color: #333;
	}
</style>
