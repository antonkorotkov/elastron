<script>
	import isEmpty from 'lodash/isEmpty'
	import { useStoreon } from '@storeon/svelte'
	import { isThemeToggleChecked } from '../../../utils/helpers'
	import profiling, { getTimeMillis, getTimeColor } from './'

	const { server, app } = useStoreon('server', 'app')

	export let query, queries

	let active = false

	$: inverted = isThemeToggleChecked($app.theme)

	$: timeInNanos = profiling.query(query).getNanos($server.version.number)
</script>

<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-noninteractive-element-interactions -->
<div
	class="title"
	class:inverted
	class:active
	on:click={() => (active = !active)}
	role="navigation"
>
	<i class="dropdown icon" />
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
				<svelte:self query={q} queries={query.children} />
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
