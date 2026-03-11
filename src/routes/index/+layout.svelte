<script>
	import { useStoreon } from '@storeon/svelte'
	import { page } from '$app/stores'
	import { goto } from '$app/navigation'
	import { resolve } from '$app/paths'
	import { isThemeToggleChecked } from '$lib/utils/helpers'
	import IndexSelector from '$lib/components/inputs/IndexSelector.svelte'
	import IconButton from '$lib/components/buttons/IconButton.svelte'

	const { dispatch, index, app } = useStoreon('index', 'app')
	let inverted = $derived(isThemeToggleChecked($app.theme))

	$effect(() => {
		if ($page.params.index && $index.selected !== $page.params.index) {
			dispatch('elasticsearch/index/select', $page.params.index)
		}
	})

	let { children } = $props()

	const tabs = [
		{ slug: 'overview', name: 'Index' },
		{ slug: 'mapping', name: 'Mapping' },
		{ slug: 'settings', name: 'Settings' },
		{ slug: 'aliases', name: 'Aliases' },
	]
</script>

<div class="ui segments">
	<div class="ui segment top-bar" class:inverted>
		<IndexSelector
			allowClear={false}
			containerStyle="display:inline-block;min-width:400px;"
			currentlySelected={$page.params.index}
			isDisabled={$index.loading}
			onSelect={e => {
				const name = e.detail.value
				// Select new index in store and navigate to it, keeping current tab if possible
				dispatch('elasticsearch/index/select', name)
				// Extract the current tab from the URL, or default to overview
				const currentPathSegments = $page.url.pathname.split('/')
				const currentTab = currentPathSegments[3] || 'overview'
				goto(resolve(`/index/${encodeURIComponent(name)}/${currentTab}`))
			}}
			onClear={() => {
				dispatch('elasticsearch/index/select', '')
				goto(resolve('/index'))
			}}
		/>

		<span class="sync">
			<IconButton
				className="sync alternate refresh"
				onClick={() => dispatch('elasticsearch/index/fetch')}
				loading={$index.loading}
			/>
		</span>
	</div>
</div>

{#if $page.params.index}
	<div class="ui grid">
		<div class="two wide column">
			<div class="ui vertical fluid pointing menu" class:inverted>
				{#each tabs as tab (tab.slug)}
					<a
						class="item"
						class:active={$page.url.pathname.includes(
							`/index/${$page.params.index}/${tab.slug}`
						)}
						href={resolve(
							`/index/${encodeURIComponent($page.params.index)}/${tab.slug}`
						)}
					>
						{tab.name}
					</a>
				{/each}
			</div>
		</div>
		<div class="fourteen wide stretched column">
			<div class="ui segment" class:inverted>
				{@render children()}
			</div>
		</div>
	</div>
{/if}

<style>
	.top-bar {
		display: flex;
		align-items: center;
	}
	.sync {
		height: 18px;
		margin-left: 1rem;
	}
</style>
