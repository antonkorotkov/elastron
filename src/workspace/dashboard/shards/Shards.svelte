<script>
	import { useStoreon } from '@storeon/svelte'
	import { onMount } from 'svelte'
	import orderBy from 'lodash/orderBy.js'
	import isEmpty from 'lodash/isEmpty.js'
	import debounce from 'lodash/debounce.js'

	import Table from '../../../components/tables/Table.svelte'
	import { filterArrayBy, shardsSortPredicate, isThemeToggleChecked } from '../../../utils/helpers.js'
	import ButtonTinyBasic from '../../../components/buttons/ButtonTinyBasic.svelte'

	const { dispatch, app, shards } = useStoreon('app', 'shards')

	let inverted = $derived(isThemeToggleChecked($app.theme))
	let shardsList = $derived($shards.data)
	let sorting = $derived($shards.sorting)
	let search = $derived($shards.search)
	let data = $derived.by(() => {
		const [ direction, column, index ] = sorting
		let list = shardsList;

		if (direction && column && index !== undefined)
			list = orderBy(list, [shardsSortPredicate(column, index)], [direction])

		if (!isEmpty(search))
			list = filterArrayBy(list, search)

		return list
	})

	onMount(() => {
		if (!$shards.data.length)
			dispatch('elasticsearch/shards/fetch')
	})

	const onSearchChange = debounce(e => {
		dispatch('elasticsearch/shards/update', { search: e.target.value })
	}, 300)

	const onRefresh = () => {
		dispatch('elasticsearch/shards/fetch')
	}

	const onSort = (column, index, direction) => {
		dispatch('elasticsearch/shards/update', { sorting: [ direction, column, index ] })
	}
</script>

<div class="ui segments">
	<div class="ui segment" class:inverted>
		<div class="ui grid">
			<div class="eight wide column middle aligned">
				<div class="ui tiny buttons">
					<ButtonTinyBasic
						label="Refresh"
						color="blue"
						loading={$shards.loading}
						onClick={onRefresh}
					/>
				</div>
			</div>
			<div class="eight wide column right aligned">
				<div class="ui search">
					<div class="ui icon input" class:inverted>
						<input
							class="prompt"
							onkeyup={onSearchChange}
							type="text"
							placeholder="Search..."
							defaultValue={search}
						>
						<i class="search icon"></i>
					</div>
				</div>
			</div>
		</div>
	</div>
	{#if $shards.columns.length}
		<div class="scrollable">
			<Table
				columns={$shards.columns}
				rows={data}
				{onSort}
				{sorting}
				emptyMessage="No shards found"
				selectable
				footerColumns
			/>
		</div>
	{:else}
		<div class="ui segment" class:inverted>
			<p>
				No
				<code>shards</code>
				data yet
			</p>
		</div>
	{/if}
</div>
