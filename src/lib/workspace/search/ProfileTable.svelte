<script>
	import isEmpty from 'lodash/isEmpty'
	import { useStoreon } from '@storeon/svelte'

	import Shard from './profiling/Shard.svelte'
	import { isThemeToggleChecked } from '../../utils/helpers'

	let { tab } = $props()

	const { app } = useStoreon('app')

	let inverted = $derived(isThemeToggleChecked($app.theme))
</script>

<div class="profile-table">
	{#if !isEmpty(tab.profile)}
		<h4 class="ui header" class:inverted>Affected Shards</h4>
		<div class="ui fluid accordion styled" class:inverted>
			{#each tab.profile.shards as shard, i (i)}
				<Shard {shard} />
			{/each}
		</div>
	{/if}
</div>

<style>
	.ui.accordion.styled.inverted {
		background-color: black;
	}

	.profile-table h4 {
		padding-left: 1rem;
		padding-top: 1rem;
	}
</style>
