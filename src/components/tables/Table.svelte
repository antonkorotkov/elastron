<script>
	import Column from './Column.svelte'
	import RowCell from './RowCell.svelte'
	import { useStoreon } from '@storeon/svelte'
	import { isThemeToggleChecked } from '../../utils/helpers'

	/**
	 * @typedef {Object} Props
	 * @property {any} columns
	 * @property {any} rows
	 * @property {['asc' | 'desc', string, number]} [sorting]
	 * @property {boolean} [selectable]
	 * @property {string} [emptyMessage]
	 * @property {any} [Cell]
	 * @property {(col: string, index: number, dir: 'asc' | 'desc') => void} [onSort]
	 */

	/** @type {Props} */
	let {
		columns,
		rows,
		sorting = [],
		selectable = false,
		emptyMessage = 'No data',
		Cell = null,
		onSort
	} = $props();

	let CellRenderer = Cell ? Cell : RowCell

	const { app } = useStoreon('app')
	const [direction,, index] = $derived(sorting)

	const onColumnClick = (column, index) => {
		if (typeof onSort !== 'function')
			return

		const newDirection = direction ? (direction === 'asc' ? 'desc' : 'asc') : 'asc';
		onSort(column, index, newDirection)
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
	class:sortable={!!onSort}
	class:inverted
>
	<thead>
		<tr>
			{#each columns as column, i (column)}
				<th
					onclick={e => onColumnClick.call(e, column, i)}
					class:sorted={i === index}
					class:ascending={direction === 'asc'}
					class:descending={direction === 'desc'}
				>
					<Column {column} />
				</th>
			{/each}
		</tr>
	</thead>
	<tbody>
		{#if rows.length}
			{#each rows as row, rowIndex (rowIndex)}
				<tr>
					{#each row as cell, i (i)}
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
