<script>
	import { onMount, getContext } from 'svelte'
	import { useStoreon } from '@storeon/svelte'
	import orderBy from 'lodash/orderBy'
	import isEmpty from 'lodash/isEmpty'
	import debounce from 'lodash/debounce'

	import { indicesSortPredicate, isThemeToggleChecked, filterArrayBy } from '../../../utils/helpers'
	import Table from '../../../components/tables/Table.svelte'
	import Cell from './Cell.svelte'
	import CreateIndexDialog from '../../../components/modal/CreateIndexDialog/CreateIndexDialog.svelte'
	import IconButton from '../../../components/buttons/IconButton.svelte'

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

	onMount(async () => {
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

	const onTableSort = (column, index, direction) => {
		dispatch('elasticsearch/indices/update', { sorting: [ direction, column, index ] })
	}
</script>

<div class="ui segments">
	<div class="ui segment" class:inverted>
		<div class="ui grid">
			<div class="eight wide column middle aligned">
				<h4>
					Indices
					<span class="add-index">
						<IconButton
							className="plus circle"
							title="Create new index"
							onClick={showCreateIndexDialog}
						/>
					</span>
				</h4>
			</div>
			<div class="eight wide column right aligned">
				<div class="ui mini form search">
					<div class="inline fields">
						<div class="field">
							<input
								onkeyup={onSearchChange}
								type="text"
								placeholder="Search"
							/>
						</div>
					</div>
				</div>

				<IconButton
					className="sync alternate refresh"
					loading={$indices.loading}
					onClick={onRefresh}
				/>
			</div>
		</div>
	</div>
	{#if $indices.columns.length}
		<Table
			columns={$indices.columns}
			rows={data}
			sorter={onTableSort}
			emptyMessage="No indices found"
			selectable
			sortable
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

<style>
	.add-index {
		margin-left: 0.5rem;
	}

	.search {
		display: inline-block;
	}

	.search .fields {
		margin: 0;
	}
</style>
