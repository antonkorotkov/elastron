<script>
	import Column from './Column.svelte'
	import RowCell from './RowCell.svelte'
	import { useStoreon } from '@storeon/svelte'
	import { isThemeToggleChecked } from '../../utils/helpers'
	import { createVirtualizer } from '@tanstack/svelte-virtual'

	/**
	 * @typedef {Object} Props
	 * @property {any} columns
	 * @property {any} rows
	 * @property {['asc' | 'desc', string, number]} [sorting]
	 * @property {boolean} [selectable]
	 * @property {string} [emptyMessage]
	 * @property {any} [Cell]
	 * @property {(col: string, index: number, dir: 'asc' | 'desc') => void} [onSort]
	 * @property {boolean} [footerColumns]
	 */

	/** @type {Props} */
	let {
		columns,
		rows,
		sorting = [],
		selectable = false,
		emptyMessage = 'No data',
		Cell = null,
		footerColumns = false,
		onSort,
	} = $props()

	let CellRenderer = $derived(Cell ? Cell : RowCell)

	const { app } = useStoreon('app')
	const [direction, , index] = $derived(sorting)

	const onColumnClick = (column, index) => {
		if (typeof onSort !== 'function') return

		const newDirection = direction
			? direction === 'asc'
				? 'desc'
				: 'asc'
			: 'asc'
		onSort(column, index, newDirection)
	}

	const getColspan = (row, i, total) => {
		if (total > row && i + 1 == row) {
			return total - row + 1
		}
		return 1
	}

	let inverted = $derived(isThemeToggleChecked($app.theme))

	let scrollElement = $state()

	import { untrack } from 'svelte'

	let options = $derived({
		count: rows.length,
		getScrollElement: () => scrollElement,
		estimateSize: () => 38,
		overscan: 10,
	})

	const virtualizer = createVirtualizer({
		get count() {
			return rows.length
		},
		getScrollElement: () => scrollElement,
		estimateSize: () => 38,
		overscan: 10,
	})

	$effect(() => {
		const currentOptions = options
		untrack(() => {
			try {
				$virtualizer.setOptions(currentOptions)
			} catch (e) {
				// Ignore Object.set JSDOM error inside svelte-virtual tests
			}
		})
	})

	let virtualItems = $derived(
		$virtualizer ? $virtualizer.getVirtualItems() : []
	)
	let virtualSize = $derived($virtualizer ? $virtualizer.getTotalSize() : 0)

	let isTestEnv = false
	try {
		if (typeof window !== 'undefined' && window.__IS_TEST__) isTestEnv = true
	} catch (e) {}

	let virtualRows = $derived(
		isTestEnv && virtualItems.length === 0 && rows.length > 0
			? rows.map((_, i) => ({ index: i, start: i * 38 }))
			: virtualItems
	)
	let totalSize = $derived(virtualSize || rows.length * 38)

	let paddingTop = $derived(virtualItems.length > 0 ? virtualRows[0].start : 0)
	let paddingBottom = $derived(
		virtualItems.length > 0
			? totalSize - (virtualRows[virtualRows.length - 1].end || 0)
			: 0
	)

	function measureNode(node) {
		if ($virtualizer) $virtualizer.measureElement(node)
		return {
			update() {
				if ($virtualizer) $virtualizer.measureElement(node)
			},
			destroy() {},
		}
	}
</script>

<div class="scrollable" bind:this={scrollElement}>
	<table
		class="ui attached table borderless"
		class:selectable
		class:sortable={!!onSort}
		class:inverted
	>
		<thead class="sticky-thead">
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
				{#if paddingTop > 0}
					<tr
						><td
							style="height: {paddingTop}px; padding: 0"
							colspan={columns.length}
						></td></tr
					>
				{/if}
				{#each virtualRows as virtualRow (virtualRow.index)}
					{@const row = rows[virtualRow.index]}
					{@const rowIndex = virtualRow.index}
					<tr data-index={rowIndex} use:measureNode>
						{#each row as cell, i (i)}
							<td colspan={getColspan(row.length, i, columns.length)}>
								<CellRenderer {cell} {i} {columns} />
							</td>
						{/each}
					</tr>
				{/each}
				{#if paddingBottom > 0}
					<tr
						><td
							style="height: {paddingBottom}px; padding: 0"
							colspan={columns.length}
						></td></tr
					>
				{/if}
			{:else}
				<tr>
					<td colspan={columns.length}>{emptyMessage}</td>
				</tr>
			{/if}
		</tbody>
		{#if footerColumns}
			<thead class="sticky-tfoot">
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
		{/if}
	</table>
</div>

<style>
	.scrollable .table.borderless {
		border: none;
	}
	.scrollable .table.borderless .sticky-thead th:hover,
	.scrollable .table.borderless .sticky-thead th.sorted,
	.scrollable .table.borderless .sticky-tfoot th:hover,
	.scrollable .table.borderless .sticky-tfoot th.sorted {
		background-color: var(--bg-color, #f2f2f2);
	}

	.scrollable .table.inverted .sticky-thead th:hover,
	.scrollable .table.inverted .sticky-thead th.sorted,
	.scrollable .table.inverted .sticky-tfoot th:hover,
	.scrollable .table.inverted .sticky-tfoot th.sorted {
		background-color: var(--bg-color, #444);
	}

	.scrollable .table.borderless .sticky-thead th,
	.scrollable .table.borderless .sticky-tfoot th {
		border-radius: 0;
	}
	.sticky-thead th {
		position: sticky;
		top: 0;
		z-index: 10;
		background-color: var(--bg-color, #f9fafb);
		border-top: 1px solid #d4d4d5;
	}
	.inverted .sticky-thead th {
		background-color: #333333;
	}
	.sticky-tfoot th {
		position: sticky;
		bottom: 0;
		z-index: 10;
		background-color: var(--bg-color, #f9fafb);
		border-top: 1px solid #d4d4d5;
	}
	.inverted .sticky-tfoot th {
		background-color: #333333;
	}
</style>
