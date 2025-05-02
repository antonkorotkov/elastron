<script>
	import Column from './Column.svelte'
	import RowCell from './RowCell.svelte'
	import { useStoreon } from '@storeon/svelte'
	import { isThemeToggleChecked } from '../../utils/helpers'

	/**
	 * @typedef {Object} Props
	 * @property {any} columns
	 * @property {any} rows
	 * @property {boolean} [sortable]
	 * @property {boolean} [selectable]
	 * @property {string} [emptyMessage]
	 * @property {any} [Cell]
	 * @property {boolean} [sorter]
	 */

	/** @type {Props} */
	let {
		columns,
		rows,
		sortable = false,
		selectable = false,
		emptyMessage = 'No data',
		Cell = null,
		sorter = false
	} = $props();

	let sorted = $state({})

	let CellRenderer = Cell ? Cell : RowCell

	const { app } = useStoreon('app')

	const onColumnClick = (column, index) => {
		if (!sortable) return

		sorted = sorted[index]
			? { [index]: sorted[index] === 'asc' ? 'desc' : 'asc' }
			: { [index]: 'asc' }

		if (typeof sorter === 'function') {
			sorter(column, index, sorted[index])
		}
	}

	const getColspan = (row, i, total) => {
		if (total > row && i + 1 == row) {
			return total - row + 1
		}
		return 1
	}

	let inverted = $derived(isThemeToggleChecked($app.theme))
</script>

<table
	class="ui attached table"
	class:selectable
	class:sortable={!!sorter}
	class:inverted
>
	<thead>
		<tr>
			{#each columns as column, i (column.id || i)}
				<th
					onclick={e => onColumnClick.call(e, column, i)}
					class:sorted={sorted[i]}
					class:ascending={sorted[i] === 'asc'}
					class:descending={sorted[i] === 'desc'}
				>
					<Column {column} />
				</th>
			{/each}
		</tr>
	</thead>
	<tbody>
		{#if rows.length}
			{#each rows as row, rowIndex (row.id || rowIndex)}
				<tr>
					{#each row as cell, i (cell.id || i)}
						<td colspan={getColspan(row.length, i, columns.length)}>
							<CellRenderer {cell} {i} {columns} />
						</td>
					{/each}
				</tr>
			{/each}
		{:else}
			<tr>
				<td colspan={columns.length}>{emptyMessage}</td>
			</tr>
		{/if}
	</tbody>
</table>
