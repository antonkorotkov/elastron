<script>
	import { useStoreon } from '@storeon/svelte'
	import { SvelteSet } from 'svelte/reactivity'
	import isEmpty from 'lodash/isEmpty'

	import ColumnsSidebar from './results-table/ColumnsSidebar.svelte'
	import RowDetail from './results-table/RowDetail.svelte'
	import { isFetchableIndex } from '../../store/elasticsearch/mappings'
	import {
		invalidJsonBodyMessage,
		isThemeToggleChecked,
		readEditorJson,
	} from '../../utils/helpers'
	import {
		CELL_MAX_CHARS,
		META_FIELDS,
		MAX_RENDERED_ROWS,
		TITLE_MAX_CHARS,
		addColumn,
		buildBodySort,
		buildFieldIndex,
		buildUriSort,
		cellValue,
		clampColumnWidth,
		columnWidth,
		columnsOf,
		currentSortState,
		formatCompactJSON,
		getAvailableFields,
		isConfigured,
		moveColumn,
		removeColumn,
		renameColumn,
		resolveSortTarget,
		setColumnWidth,
	} from '../../utils/tableHelpers'

	/**
	 * @typedef {Object} Props
	 * @property {{ getText?: () => string, set?: (json: object) => void }} [qEditor]
	 *   the request body editor, so sorting in body mode rewrites the body the
	 *   user can see rather than a copy of it
	 */

	/** @type {Props} */
	let { qEditor = null } = $props()

	const { dispatch, search, app, mappings } = useStoreon(
		'search',
		'app',
		'mappings'
	)

	const EXPAND_COLUMN_WIDTH = 45

	let sidebarOpen = $state(true)
	let expandedRows = new SvelteSet()
	let rowTabs = $state({})

	// Geometry of an in-progress column drag. `resizeField` drives the listener
	// effect, `resizePreview` the live width; the rest is deliberately outside
	// reactive state so a mousemove cannot re-run the effect that installed it.
	let resizeField = $state(null)
	let resizePreview = $state(0)
	let resizeGeometry = null

	let inverted = $derived(isThemeToggleChecked($app?.theme))

	let active = $derived($search?.view === 'table')
	let indexName = $derived(String($search?.index ?? '').trim() || '_all')

	let mappingInfo = $derived($mappings?.info?.[indexName] ?? null)
	let loadingMapping = $derived(!!$mappings?.loading?.[indexName])
	let fieldIndex = $derived(buildFieldIndex(mappingInfo))

	let config = $derived($search?.tableConfigs?.[indexName] ?? null)
	let configured = $derived(isConfigured(config))
	let columns = $derived(columnsOf(config))

	let observedFields = $derived(getAvailableFields(mappingInfo, $search?.results))
	let selectableFields = $derived([
		...META_FIELDS,
		...observedFields.filter(field => !META_FIELDS.includes(field)),
	])

	let sortState = $derived(currentSortState($search))

	let hits = $derived(Array.isArray($search?.results) ? $search.results : [])
	let visibleHits = $derived(hits.slice(0, MAX_RENDERED_ROWS))
	let hiddenCount = $derived(hits.length - visibleHits.length)

	let tableWidth = $derived(
		columns.reduce(
			(total, column) => total + displayWidth(column),
			EXPAND_COLUMN_WIDTH
		)
	)

	// The table stays mounted behind the view toggle, so the mapping is only
	// worth fetching once the user actually looks at it. The store owns the
	// caching, so a repeat dispatch is a no-op and a failed index can retry.
	$effect(() => {
		if (!active || !isFetchableIndex(indexName)) return
		dispatch('elasticsearch/mappings/fetch', { index: indexName })
	})

	// Matching a row across two different queries is coincidence, not intent.
	let lastResults = null
	$effect(() => {
		const results = $search?.results
		if (results === lastResults) return
		lastResults = results
		expandedRows.clear()
		rowTabs = {}
	})

	$effect(() => {
		const field = resizeField
		if (!field) return

		const onMove = event => {
			resizePreview = resizeGeometry.startWidth + (event.clientX - resizeGeometry.startX)
		}
		const onUp = () => {
			// A click on the handle that never moved must not persist a layout:
			// that would turn an index with no saved columns into a configured
			// one holding nothing but the defaults.
			if (resizePreview !== resizeGeometry.startWidth) {
				saveColumns(setColumnWidth(columns, field, resizePreview))
			}
			resizeField = null
			resizeGeometry = null
		}

		window.addEventListener('mousemove', onMove)
		window.addEventListener('mouseup', onUp)
		return () => {
			window.removeEventListener('mousemove', onMove)
			window.removeEventListener('mouseup', onUp)
		}
	})

	function displayWidth(column) {
		return column.field === resizeField
			? clampColumnWidth(resizePreview)
			: columnWidth(column)
	}

	const saveColumns = nextColumns =>
		dispatch('search/tableConfigs/update', {
			index: indexName,
			config: { columns: nextColumns },
		})

	const toggleColumn = field => {
		const selected = columns.some(column => column.field === field)
		saveColumns(
			selected
				? removeColumn(columns, field)
				: addColumn(columns, field, configured)
		)
	}

	const onMoveColumn = (from, to) => saveColumns(moveColumn(columns, from, to))

	const onRenameColumn = (field, name) =>
		saveColumns(renameColumn(columns, field, name))

	// Saving an empty layout deletes the entry, returning the index to defaults.
	const resetColumns = () => saveColumns([])

	const onResizeStart = (event, column) => {
		event.preventDefault()
		event.stopPropagation()
		resizeGeometry = { startX: event.clientX, startWidth: columnWidth(column) }
		resizePreview = resizeGeometry.startWidth
		resizeField = column.field
	}

	/**
	 * Sorting goes to the cluster, not to the loaded page: sorting ten of ten
	 * thousand hits and presenting it as an ordering would be a lie. Offset is
	 * reset because page 5 of a re-sorted result set is an arbitrary window.
	 */
	const applySort = (field, direction) => {
		if ($search.type === 'body') {
			const { requestBody, error } = readEditorJson(qEditor, $search.requestBody)
			if (error) {
				dispatch('notification/add', {
					type: 'error',
					message: invalidJsonBodyMessage(error),
				})
				return
			}

			const nextBody = {
				...requestBody,
				sort: buildBodySort(field, direction),
				from: 0,
			}
			if (typeof qEditor?.set === 'function') qEditor.set(nextBody)
			dispatch('search/update', { requestBody: nextBody })
		} else {
			dispatch('search/update', {
				sort: buildUriSort(field, direction),
				from: 0,
			})
		}

		dispatch('search/run')
	}

	const sortTargetOf = column => resolveSortTarget(column.field, fieldIndex)

	const sortDirectionOf = column => {
		const target = sortTargetOf(column)
		return target && sortState?.field === target ? sortState.direction : null
	}

	const onHeaderClick = column => {
		const target = sortTargetOf(column)
		if (!target) return
		applySort(target, sortDirectionOf(column) === 'asc' ? 'desc' : 'asc')
	}

	const headerTitle = column => {
		const target = sortTargetOf(column)
		if (!target) return `${column.field} cannot be sorted on`
		if (target !== column.field) return `Sort by ${target}`
		return `Sort by ${column.field}`
	}

	const rowId = (hit, position) => `${position}:${hit?._index}/${hit?._id}`

	const toggleRowExpanded = id => {
		if (expandedRows.has(id)) expandedRows.delete(id)
		else expandedRows.add(id)
	}

	const copyToClipboard = async text => {
		try {
			await navigator.clipboard.writeText(text)
			dispatch('notification/add', {
				type: 'success',
				message: 'Copied document to clipboard!',
			})
		} catch (error) {
			dispatch('notification/add', {
				type: 'error',
				message: `Could not copy to clipboard: ${error.message}`,
			})
		}
	}
</script>

<div class="results-table-container" class:inverted>
	{#if sidebarOpen}
		<ColumnsSidebar
			{columns}
			{inverted}
			availableFields={selectableFields}
			loading={loadingMapping}
			onToggle={toggleColumn}
			onMove={onMoveColumn}
			onRename={onRenameColumn}
			onReset={resetColumns}
		/>
	{/if}

	<div class="table-panel">
		<div class="table-toolbar" class:inverted>
			<button
				class="ui button mini"
				class:inverted
				onclick={() => (sidebarOpen = !sidebarOpen)}
				title={sidebarOpen ? 'Hide the column picker' : 'Show the column picker'}
			>
				<i class="columns icon"></i>
				{sidebarOpen ? 'Hide Columns' : 'Columns'}
			</button>
			<div class="stats-label">
				{#if hiddenCount > 0}
					Showing {visibleHits.length} of {hits.length} documents — reduce Size
					or refine the query to see the rest
				{:else}
					Showing {hits.length} document{hits.length === 1 ? '' : 's'}
				{/if}
			</div>
		</div>

		<div class="table-scroll-wrapper">
			{#if isEmpty(visibleHits)}
				<div class="ui placeholder segment center aligned" class:inverted>
					<div class="ui icon header">
						<i class="search icon"></i>
						No search results found
					</div>
				</div>
			{:else}
				<table
					class="ui celled compact table results-grid"
					class:inverted
					style="width: {tableWidth}px"
				>
					<colgroup>
						<col style="width: {EXPAND_COLUMN_WIDTH}px" />
						{#each columns as column (column.field)}
							<col style="width: {displayWidth(column)}px" />
						{/each}
					</colgroup>
					<thead>
						<tr>
							<th class="expand-header-col"></th>
							{#each columns as column (column.field)}
								{@const direction = sortDirectionOf(column)}
								{@const sortable = !!sortTargetOf(column)}
								<th
									class:resizing={resizeField === column.field}
									title={headerTitle(column)}
								>
									<button
										type="button"
										class="header-content"
										class:sortable
										disabled={!sortable}
										onclick={() => onHeaderClick(column)}
									>
										<span class="header-label">{column.name}</span>
										{#if direction}
											<i
												class="sort icon"
												class:up={direction === 'asc'}
												class:down={direction === 'desc'}
											></i>
										{/if}
									</button>
									<!-- svelte-ignore a11y_no_static_element_interactions -->
									<span
										class="col-resizer"
										onmousedown={event => onResizeStart(event, column)}
									></span>
								</th>
							{/each}
						</tr>
					</thead>
					<tbody>
						{#each visibleHits as hit, position (rowId(hit, position))}
							{@const id = rowId(hit, position)}
							{@const expanded = expandedRows.has(id)}
							<tr class="data-row">
								<td class="center aligned expand-cell">
									<button
										class="expand-row-btn"
										aria-expanded={expanded}
										aria-label={expanded ? 'Collapse row' : 'Expand row'}
										title={expanded ? 'Collapse row' : 'Expand row'}
										onclick={() => toggleRowExpanded(id)}
									>
										<i
											class="caret icon"
											class:right={!expanded}
											class:down={expanded}
										></i>
									</button>
								</td>
								{#each columns as column (column.field)}
									<td
										class="cell-value"
										title={formatCompactJSON(
											cellValue(hit, column.field),
											TITLE_MAX_CHARS
										)}
									>
										{#if column.field === '_id' || column.field === '_index'}
											<span
												class="meta-tag"
												class:index-tag={column.field === '_index'}
											>
												{cellValue(hit, column.field)}
											</span>
										{:else}
											{formatCompactJSON(
												cellValue(hit, column.field),
												CELL_MAX_CHARS
											)}
										{/if}
									</td>
								{/each}
							</tr>

							{#if expanded}
								<tr class="expanded-row">
									<td></td>
									<td colspan={columns.length} class="detail-container-cell">
										<RowDetail
											{hit}
											{columns}
											{inverted}
											tab={rowTabs[id] ?? 'table'}
											onTab={tab => (rowTabs[id] = tab)}
											onToggleColumn={toggleColumn}
											onCopy={copyToClipboard}
										/>
									</td>
								</tr>
							{/if}
						{/each}
					</tbody>
				</table>
			{/if}
		</div>
	</div>
</div>

<style lang="scss">
	.results-table-container {
		display: flex;
		flex-direction: row;
		height: 100%;
		width: 100%;
		overflow: hidden;
		background: #fff;
		border-radius: 4px;

		&.inverted {
			background: #1b1c1d;
		}
	}

	.table-panel {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-width: 0;
		overflow: hidden;
	}

	.table-toolbar {
		display: flex;
		align-items: center;
		padding: 0.8rem 1rem;
		border-bottom: 1px solid #e0e0e0;
		gap: 8px;
		background: #fdfdfd;

		&.inverted {
			border-color: #555;
			background: #252627;
		}

		.stats-label {
			margin-left: auto;
			font-size: 0.85rem;
			color: #777;
			text-align: right;
		}
	}

	.table-scroll-wrapper {
		flex: 1;
		overflow: auto;
	}

	.results-grid {
		margin: 0 !important;
		border-radius: 0 !important;
		border-left: none !important;
		border-right: none !important;
		border-bottom: none !important;
		table-layout: fixed;
		min-width: 100%;

		th {
			// `sticky` also makes the header the containing block the resize
			// handle positions itself against.
			position: sticky;
			top: 0;
			z-index: 10;
			overflow: hidden;
			background: #f9fafb !important;
			box-shadow: 0 1px 0 #d4d4d5;
			padding: 0 !important;

			&.resizing {
				background: #eef3f8 !important;
			}
		}

		&.inverted th {
			background: #202122 !important;
			box-shadow: 0 1px 0 #555;
			color: #fff !important;

			&.resizing {
				background: #2d2e2f !important;
			}
		}

		.expand-header-col {
			padding: 0 !important;
		}

		.expand-cell {
			padding: 0 !important;
		}

		.expand-row-btn {
			background: none;
			border: none;
			padding: 8px 12px;
			cursor: pointer;
			color: #555;
			outline: none;

			&:hover {
				color: #2185d0;
			}
		}

		&.inverted .expand-row-btn {
			color: #ccc;
		}

		.cell-value {
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
			font-size: 0.85rem;
			// Pinned in px to match `.header-content`: Semantic sizes header and
			// body padding in `em` against two different font sizes, which left
			// the column text a few pixels out of alignment with its heading.
			padding: 6px 10px !important;
		}

		.meta-tag {
			background: #e8e8e8;
			color: #333;
			padding: 2px 6px;
			border-radius: 3px;
			font-family: monospace;
			font-size: 0.8rem;

			&.index-tag {
				background: #dff0ff;
				color: #0e566c;
			}
		}

		&.inverted .meta-tag {
			background: #444;
			color: #eee;

			&.index-tag {
				background: #1e3a5f;
				color: #8faec4;
			}
		}
	}

	.header-content {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 6px;
		width: 100%;
		padding: 10px;
		background: none;
		border: none;
		font: inherit;
		color: inherit;
		text-align: left;
		cursor: default;

		&.sortable {
			cursor: pointer;

			&:hover {
				background: rgba(0, 0, 0, 0.05);
			}
		}

		&:disabled {
			opacity: 0.75;
		}
	}

	.header-label {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.col-resizer {
		position: absolute;
		top: 0;
		right: 0;
		width: 7px;
		height: 100%;
		cursor: col-resize;
		user-select: none;

		&:hover {
			background: #2185d0;
			opacity: 0.4;
		}
	}

	.expanded-row {
		background: #f9f9f9 !important;

		&:hover {
			background: #f9f9f9 !important;
		}
	}

	.results-table-container.inverted .expanded-row {
		background: #161718 !important;

		&:hover {
			background: #161718 !important;
		}
	}

	.detail-container-cell {
		padding: 1.2rem !important;
		border-top: none !important;
	}
</style>
