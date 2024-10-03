<script>
	import JSONEditor from 'jsoneditor'
	import { useStoreon } from '@storeon/svelte'
	import { getContext } from 'svelte'
	import get from 'lodash/get'

	import Table from '../../../components/tables/Table.svelte'
	import Cell from './AliasTableCell.svelte'
	import CreateAliasDialog from '../../../components/modal/CreateAliasDialog/CreateAliasDialog.svelte'

	const { open } = getContext('modal-window')
	const { index } = useStoreon('index')

	let isLoading = false

	const columns = [
		'Name',
		'Filter',
		'Is Write Index',
		'Index Routing',
		'Search Routing',
		'Actions',
	]

	$: rows = () => {
		const _rows = []
		const aliases = get(
			$index,
			['info', $index.selected, $index.selected, 'aliases'],
			{}
		)
		for (let i in aliases) {
			let alias = aliases[i]
			let filter = get(alias, 'filter', false)
			let row = [
				i,
				filter ? JSON.stringify(filter, null, '  ') : '',
				get(alias, 'is_write_index', false),
				get(alias, 'index_routing', ''),
				get(alias, 'search_routing', ''),
				i,
			]
			_rows.push(row)
		}

		return _rows
	}

	const onCreateClick = () => {
		open(CreateAliasDialog, {
			aliases: get(
				$index,
				['info', $index.selected, $index.selected, 'aliases'],
				{}
			),
		})
	}
</script>

<div class="ui tiny buttons">
	<button
		class="ui tiny blue basic button"
		on:click={onCreateClick}
		class:loading={isLoading}
		disabled={isLoading}
	>
		Create
	</button>
</div>
<div class="ui vertical segment">
	<Table
		{columns}
		rows={rows()}
		{Cell}
		emptyMessage="No aliases found"
		selectable
		sortable
	/>
</div>
