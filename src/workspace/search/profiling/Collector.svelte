<script>
	import Collector from './Collector.svelte';
	import { useStoreon } from '@storeon/svelte'
	import profiling, { getTimeMillis, getTimeColor } from './'
	import { isThemeToggleChecked } from '../../../utils/helpers'

	const { server, app } = useStoreon('server', 'app')

	let { collector, collectors } = $props();

	let active = $state(false)

	let timeInNanos = $derived(profiling
		.collector(collector)
		.getNanos($server.version.number))

	let inverted = $derived(isThemeToggleChecked($app.theme))
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
	{profiling.collector(collector).getName($server.version.number)}
	<small
		class="ui label"
		style="background-color:{getTimeColor(
			timeInNanos,
			collectors.map(c =>
				profiling.collector(c).getNanos($server.version.number)
			)
		)}"
	>
		{getTimeMillis(timeInNanos || 0)}ms
	</small>
</div>
<div class="content" class:active>
	<small class="ui label">
		{profiling.collector(collector).getReason($server.version.number)}
	</small>
	{#if collector.children && collector.children.length}
		<div class="ui fluid accordion styled" class:inverted>
			{#each collector.children as q, i}
				<Collector collector={q} collectors={collector.children} />
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
