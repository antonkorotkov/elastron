<script>
	import { useStoreon } from '@storeon/svelte'

	import Indices from './indices/Indices.svelte'
	import Allocation from './allocation/Allocation.svelte'
	import Shards from './shards/Shards.svelte'
	import TabLink from '../../components/tabs/TabLink.svelte'
	import TabContent from '../../components/tabs/TabContent.svelte'
	import { isThemeToggleChecked } from '../../utils/helpers'

	const { app } = useStoreon('app')

	let active = $state('indices')
	let inverted = $derived(isThemeToggleChecked($app.theme))

	const changeTab = name => active = name
</script>

<div class="ui pointing secondary menu" class:inverted>
	<TabLink label="Indices" name="indices" {active} onClick={changeTab} />
	<TabLink label="Shards" name="shards" {active} onClick={changeTab} />
	<TabLink label="Allocation" name="allocation" {active} onClick={changeTab} />
</div>

<div>
	<TabContent name="indices" {active}>
		<Indices />
	</TabContent>
	<TabContent name="shards" {active}>
		<Shards />
	</TabContent>
	<TabContent name="allocation" {active}>
		<Allocation />
	</TabContent>
</div>
