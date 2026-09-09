<script>
	import { useStoreon } from '@storeon/svelte'
	import { SvelteSet } from 'svelte/reactivity'

	import Search from '$lib/workspace/search/Search.svelte'
	import SearchTabs from '$lib/workspace/search/SearchTabs.svelte'

	const { search } = useStoreon('search')

	// A tab mounts the first time it becomes active and then stays mounted,
	// hidden, so its editors keep half-typed text, scroll and expanded rows
	// across switches. Mounting every restored tab up front would create their
	// editors inside hidden boxes, which they measure wrongly.
	const visited = new SvelteSet([$search.activeId])

	$effect(() => {
		visited.add($search.activeId)
	})

	let mounted = $derived($search.tabs.filter(tab => visited.has(tab.id)))
</script>

<SearchTabs />

{#each mounted as tab (tab.id)}
	{@const active = tab.id === $search.activeId}
	<div class="tab-host" class:hidden={!active}>
		<Search {tab} {active} />
	</div>
{/each}

<style>
	/* The tab bar's rendered height plus its bottom margin, handed to the
	   search view so it can give that much of the viewport back. */
	.tab-host {
		--search-tab-bar-height: 47px;
	}

	.hidden {
		display: none !important;
	}
</style>
