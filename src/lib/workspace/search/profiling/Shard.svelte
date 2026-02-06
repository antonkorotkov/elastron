<script>

	import Search from './Search.svelte'
	import Aggregations from './Aggregations.svelte'
	let { shard } = $props();

	let active = $state(false)
</script>

<div class="profile-table__shard">
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<div
		class="title"
		class:active
		onclick={() => (active = !active)}
		role="button"
		tabindex="0"
	>
		<i class="dropdown icon"></i>
		{shard.id}
	</div>
	<div class="content" class:active>
		{#if shard.searches && shard.searches.length}
			{#each shard.searches as search, i}
				<Search {search} />
			{/each}
		{/if}
		{#if shard.aggregations && shard.aggregations.length}
			<Aggregations aggregations={shard.aggregations} />
		{/if}
	</div>
</div>
