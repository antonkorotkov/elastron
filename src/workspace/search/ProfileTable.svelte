<script>
	import isEmpty from 'lodash/isEmpty'
	import { useStoreon } from '@storeon/svelte'

	import Shard from './profiling/Shard.svelte'
	import { isThemeToggleChecked } from '../../utils/helpers'

	const { app, search } = useStoreon('search', 'app')

	let inverted = $derived(isThemeToggleChecked($app.theme))
</script>

<div class="profile-table">
	{#if !isEmpty($search.profile)}
		<h4 class="ui header" class:inverted>Affected Shards</h4>
		<div class="ui fluid accordion styled" class:inverted>
			{#each $search.profile.shards as shard, i}
				<Shard {shard} />
			{/each}
		</div>
	{/if}
</div>

<style>
	.ui.accordion.styled.inverted {
		background-color: black;
	}
</style>
