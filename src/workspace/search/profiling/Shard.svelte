<script>
	export let shard

	import Search from './Search.svelte'
	import Aggregations from './Aggregations.svelte'

	let active = false
</script>

<div class="profile-table__shard">
	<!-- svelte-ignore a11y-click-events-have-key-events -->
	<div
		class="title"
		class:active
		on:click={() => (active = !active)}
		role="button"
		tabindex="0"
	>
		<i class="dropdown icon" />
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
