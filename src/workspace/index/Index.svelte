<script>
	import { useStoreon } from '@storeon/svelte'
	import { routerKey } from '@storeon/router'
	import { onMount } from 'svelte'

	import Index from './tabs/Index.svelte'
	import Mapping from './tabs/Mapping.svelte'
	import Aliases from './tabs/Aliases.svelte'
	import Settings from './tabs/Settings.svelte'
	import { isThemeToggleChecked } from '../../utils/helpers'
	import IndexSelector from '../../components/inputs/IndexSelector.svelte'
	import IconButton from '../../components/buttons/IconButton.svelte'

	const {
		dispatch,
		[routerKey]: route,
		index,
		app,
	} = useStoreon(routerKey, 'index', 'app')

	let activeTab = $state()

	const tabs = [
		{ slug: 'index', name: 'Index', Component: Index },
		{ slug: 'mapping', name: 'Mapping', Component: Mapping },
		{ slug: 'settings', name: 'Settings', Component: Settings },
		{ slug: 'aliases', name: 'Aliases', Component: Aliases },
	]

	let inverted = $derived(isThemeToggleChecked($app.theme))

	onMount(() => {
		dispatch('elasticsearch/index/select', $route.match.index || '')
		activeTab = 'index'
	})
</script>

<div class="ui segments">
	<div class="ui segment top-bar" class:inverted>
		<IndexSelector
			allowClear={false}
			containerStyle="display:inline-block;min-width:400px;"
			currentlySelected={$index.selected}
			isDisabled={$index.loading}
			onSelect={e => {
				dispatch('elasticsearch/index/select', e.detail.value)
				activeTab = 'index'
			}}
			onClear={() => dispatch('elasticsearch/index/select', '')}
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

{#if $index.selected}
	<div class="ui grid">
		<div class="two wide column">
			<div class="ui vertical fluid pointing menu" class:inverted>
				{#each tabs as tab}
					<a
						class="item"
						class:active={activeTab === tab.slug}
						href="#0"
						onclick={e => (activeTab = tab.slug)}
					>
						{tab.name}
					</a>
				{/each}
			</div>
		</div>
		<div class="fourteen wide stretched column">
			<div class="ui segment" class:inverted>
				{#each tabs as tab}
					{#if activeTab === tab.slug}
						<tab.Component />
					{/if}
				{/each}
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
