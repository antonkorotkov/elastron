<script>
	import { useStoreon } from '@storeon/svelte'
	import { getContext } from 'svelte'
	import get from 'lodash/get'

	import Table from '../../../components/tables/Table.svelte'
	import Cell from './AliasTableCell.svelte'
	import CreateAliasDialog from '../../../components/modal/CreateAliasDialog/CreateAliasDialog.svelte'

	const { open } = getContext('modal-window')
	const { dispatch, index } = useStoreon('index')
	let isLoading = false

	const columns = [
		'Name',
		'Filter',
		'Is Write Index',
		'Index Routing',
		'Search Routing',
		'Actions',
	]

	function buildRows() {
		const _rows = []
		const aliases = get($index, ['info', $index.selected, $index.selected, 'aliases'], {})
		for (let i in aliases) {
			let alias = aliases[i]
			let filter = get(alias, 'filter', false)
			_rows.push([
				i,
				filter ? JSON.stringify(filter, null, '  ') : '',
				get(alias, 'is_write_index', false),
				get(alias, 'index_routing', ''),
				get(alias, 'search_routing', ''),
				i,
			])
		}
		return _rows
	}

	let rows = $derived(buildRows())

	const onCreateClick = () => {
		open(CreateAliasDialog, {
			aliases: get($index, ['info', $index.selected, $index.selected, 'aliases'], {}),
		})
	}
</script>

<div class="ui tiny buttons">
	<button
		class="ui tiny blue basic button"
		onclick={onCreateClick}
		class:loading={isLoading}
		disabled={isLoading}
	>
		Create
	</button>
</div>
<div class="ui vertical segment">
	<Table
		{columns}
		{rows}
		{Cell}
		emptyMessage="No aliases found"
		selectable
		sortable
	/>
</div>
