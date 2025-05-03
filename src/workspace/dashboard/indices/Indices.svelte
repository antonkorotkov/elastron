<script>
	import { onMount, getContext } from 'svelte'
	import { useStoreon } from '@storeon/svelte'
	import orderBy from 'lodash/orderBy.js'
	import isEmpty from 'lodash/isEmpty.js'
	import debounce from 'lodash/debounce.js'

	import { indicesSortPredicate, isThemeToggleChecked, filterArrayBy } from '../../../utils/helpers'
	import Table from '../../../components/tables/Table.svelte'
	import Cell from './Cell.svelte'
	import CreateIndexDialog from '../../../components/modal/CreateIndexDialog/CreateIndexDialog.svelte'
	import ButtonTinyBasic from '../../../components/buttons/ButtonTinyBasic.svelte'

	const { dispatch, app, indices } = useStoreon('app', 'indices')
	const { open } = getContext('modal-window')

	let inverted = $derived(isThemeToggleChecked($app.theme))
	let indicesList = $derived($indices.data)
	let sorting = $derived($indices.sorting)
	let search = $derived($indices.search)
	let data = $derived.by(() => {
		const [ direction, column, index ] = sorting
		let list = indicesList;

		if (direction && column && index !== undefined)
			list = orderBy(list, [indicesSortPredicate(column, index)], [direction])

		if (!isEmpty(search))
			list = filterArrayBy(list, search)

		return list
	})

	onMount(() => {
		if (!$indices.data.length)
			dispatch('elasticsearch/indices/fetch')
	})

	const showCreateIndexDialog = () => {
		open(CreateIndexDialog)
	}

	const onSearchChange = debounce(e => {
		dispatch('elasticsearch/indices/update', { search: e.target.value })
	}, 300)

	const onRefresh = () => {
		dispatch('elasticsearch/indices/fetch')
	}

	const onSort = (column, index, direction) => {
		dispatch('elasticsearch/indices/update', { sorting: [ direction, column, index ] })
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
						loading={$indices.loading}
						onClick={onRefresh}
					/>
					<ButtonTinyBasic
						label="Create"
						color="green"
						loading={$indices.loading}
						onClick={showCreateIndexDialog}
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
	{#if $indices.columns.length}
		<Table
			columns={$indices.columns}
			rows={data}
			{onSort}
			{sorting}
			emptyMessage="No indices found"
			selectable
			{Cell}
		/>
	{:else}
		<div class="ui segment" class:inverted>
			<p>
				No
				<code>indices</code>
				data yet
			</p>
		</div>
	{/if}
</div>
