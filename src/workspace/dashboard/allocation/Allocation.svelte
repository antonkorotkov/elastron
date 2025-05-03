<script>
	import { useStoreon } from '@storeon/svelte'
	import { onMount } from 'svelte'
	import orderBy from 'lodash/orderBy.js'
	import isEmpty from 'lodash/isEmpty.js'
	import debounce from 'lodash/debounce.js'

	import Table from '../../../components/tables/Table.svelte'
	import { filterArrayBy, isThemeToggleChecked, allocationSortPredicate } from '../../../utils/helpers.js'
	import ButtonTinyBasic from '../../../components/buttons/ButtonTinyBasic.svelte'

	const { dispatch, app, allocation } = useStoreon('app', 'allocation')

	let inverted = $derived(isThemeToggleChecked($app.theme))
	let allocationList = $derived($allocation.data)
	let sorting = $derived($allocation.sorting)
	let search = $derived($allocation.search)
	let data = $derived.by(() => {
		const [ direction, column, index ] = sorting
		let list = allocationList;

		if (direction && column && index !== undefined)
			list = orderBy(list, [allocationSortPredicate(column, index)], [direction])

		if (!isEmpty(search))
			list = filterArrayBy(list, search)

		return list
	})

	onMount(() => {
		if (!$allocation.data.length)
			dispatch('elasticsearch/allocation/fetch')
	})

	const onSearchChange = debounce(e => {
		dispatch('elasticsearch/allocation/update', { search: e.target.value })
	}, 300)

	const onRefresh = () => {
		dispatch('elasticsearch/allocation/fetch')
	}

	const onSort = (column, index, direction) => {
		dispatch('elasticsearch/allocation/update', { sorting: [ direction, column, index ] })
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
						loading={$allocation.loading}
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
	{#if $allocation.columns.length}
		<Table
			columns={$allocation.columns}
			rows={data}
			emptyMessage="No allocations found"
			{onSort}
			{sorting}
			selectable
		/>
	{:else}
		<div class="ui segment" class:inverted>
			<p>
				No
				<code>allocation</code>
				data yet
			</p>
		</div>
	{/if}
</div>
