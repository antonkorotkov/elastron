<script>
	import { useStoreon } from '@storeon/svelte'
	import { getContext } from 'svelte'
	import get from 'lodash/get'
	import isEmpty from 'lodash/isEmpty'
	import API from '../../api/elasticsearch'
	import { isThemeToggleChecked } from '../../utils/helpers'
	import {
		getAvailableFields,
		formatCompactJSON,
		flattenObject,
	} from '../../utils/tableHelpers'

	const { dispatch, search, connection, app } = useStoreon(
		'search',
		'connection',
		'app'
	)

	let sidebarOpen = $state(true)
	let searchQuery = $state('')
	let indexMapping = $state(null)
	let loadingMapping = $state(false)

	// Column renaming state
	let editingField = $state(null)
	let renameValue = $state('')

	// Table sorting state
	let sortField = $state(null)
	let sortDirection = $state('asc') // 'asc' | 'desc'

	// Row expansion state
	let expandedRows = $state(new Set())
	let rowTabs = $state({}) // { [rowId]: 'table' | 'json' }

	let inverted = $derived(isThemeToggleChecked($app?.theme))

	// Fetch index mapping reactively when index or connection changes
	$effect(() => {
		const index = $search?.index
		const conn = $connection

		const fetchMapping = async () => {
			if (!index || index === '_all' || index.includes(',')) {
				indexMapping = null
				return
			}
			loadingMapping = true
			try {
				const api = new API(conn)
				const info = await api.getIndex(index)
				indexMapping = info
			} catch (err) {
				console.error('Failed to fetch index mapping:', err)
				indexMapping = null
			} finally {
				loadingMapping = false
			}
		}

		fetchMapping()
	})

	// Table configuration for the current connection and index
	let configKey = $derived(
		`${$connection?.name || $connection?.host || 'default'}_${$search?.index || '_all'}`
	)

	let currentConfig = $derived(
		($search?.tableConfigs && $search.tableConfigs[configKey]) || {
			columns: [
				{ field: '_id', name: '_id' },
				{ field: '_source', name: '_source' },
			],
		}
	)

	let columns = $derived(currentConfig.columns)

	// List of all unique fields from mapping + results
	let allFields = $derived(getAvailableFields(indexMapping, $search?.results))

	// Filter available fields based on search input
	let filteredAvailableFields = $derived(
		allFields.filter(
			field =>
				field.toLowerCase().includes(searchQuery.toLowerCase()) &&
				!columns.some(col => col.field === field)
		)
	)

	// Client-side sorting of the current search hits
	let sortedResults = $derived.by(() => {
		const hits = Array.isArray($search?.results) ? [...$search.results] : []
		if (!sortField) return hits

		return hits.sort((a, b) => {
			let valA = sortField === '_id' ? a._id : get(a._source, sortField)
			let valB = sortField === '_id' ? b._id : get(b._source, sortField)

			if (valA === undefined || valA === null) valA = ''
			if (valB === undefined || valB === null) valB = ''

			if (typeof valA === 'object') valA = JSON.stringify(valA)
			if (typeof valB === 'object') valB = JSON.stringify(valB)

			if (valA < valB) return sortDirection === 'asc' ? -1 : 1
			if (valA > valB) return sortDirection === 'asc' ? 1 : -1
			return 0
		})
	})

	const saveConfig = (updatedConfig) => {
		dispatch('search/tableConfigs/update', {
			connectionKey: $connection?.name || $connection?.host || 'default',
			indexName: $search?.index || '_all',
			config: updatedConfig,
		})
	}

	const toggleColumn = (field) => {
		let cols = [...columns]
		const idx = cols.findIndex(c => c.field === field)

		if (idx > -1) {
			// Remove column
			cols.splice(idx, 1)
			if (cols.length === 0) {
				cols = [
					{ field: '_id', name: '_id' },
					{ field: '_source', name: '_source' },
				]
			}
		} else {
			// Add column
			const isDefault =
				cols.length === 2 &&
				cols.some(c => c.field === '_id') &&
				cols.some(c => c.field === '_source')

			if (isDefault) {
				cols = cols.filter(c => c.field !== '_source')
			}
			cols.push({ field, name: field })
		}

		saveConfig({ columns: cols })
	}

	const moveColumnUp = (index) => {
		if (index === 0) return
		const cols = [...columns]
		const temp = cols[index]
		cols[index] = cols[index - 1]
		cols[index - 1] = temp
		saveConfig({ columns: cols })
	}

	const moveColumnDown = (index) => {
		if (index === columns.length - 1) return
		const cols = [...columns]
		const temp = cols[index]
		cols[index] = cols[index + 1]
		cols[index + 1] = temp
		saveConfig({ columns: cols })
	}

	const startRename = (field, name) => {
		editingField = field
		renameValue = name
	}

	const saveRename = (field) => {
		const cols = columns.map(c => {
			if (c.field === field) {
				return { ...c, name: renameValue.trim() || field }
			}
			return c
		})
		saveConfig({ columns: cols })
		editingField = null
	}

	const resetColumns = () => {
		saveConfig({
			columns: [
				{ field: '_id', name: '_id' },
				{ field: '_source', name: '_source' },
			],
		})
	}

	const handleHeaderClick = (field) => {
		if (sortField === field) {
			sortDirection = sortDirection === 'asc' ? 'desc' : 'asc'
		} else {
			sortField = field
			sortDirection = 'asc'
		}
	}

	const rowKey = (hit) => `${hit._index}/${hit._id}`

	const toggleRowExpanded = (rowId) => {
		const next = new Set(expandedRows)
		if (next.has(rowId)) {
			next.delete(rowId)
		} else {
			next.add(rowId)
		}
		expandedRows = next
	}

	const copyToClipboard = (text) => {
		navigator.clipboard.writeText(text)
		dispatch('notification/add', {
			type: 'success',
			message: 'Copied document to clipboard!',
		})
	}

	const autofocus = (node) => {
		node.focus()
	}

	const getRowTab = (id) => rowTabs[id] || 'table'
</script>

<div class="results-table-container" class:inverted>
	<!-- Left Collapsible Sidebar -->
	{#if sidebarOpen}
		<div class="sidebar-panel" class:inverted>
			<div class="panel-header">
				<h3>Columns</h3>
			</div>

			<!-- Selected Columns List -->
			<div class="selected-section">
				<h4 class="section-title">Selected ({columns.length})</h4>
				<div class="column-list" class:inverted>
					{#each columns as col, idx}
						<div class="column-item selected" class:inverted>
							<div class="col-main">
								{#if editingField === col.field}
									<input
										type="text"
										class="rename-input"
										bind:value={renameValue}
										onblur={() => saveRename(col.field)}
										onkeydown={e => e.key === 'Enter' && saveRename(col.field)}
										use:autofocus
									/>
								{:else}
									<span class="col-name" title={col.field}>{col.name}</span>
									{#if col.field !== col.name}
										<span class="col-original">({col.field})</span>
									{/if}
								{/if}
							</div>
							<div class="col-actions">
								<button
									class="action-btn"
									title="Rename"
									onclick={() => startRename(col.field, col.name)}
								>
									<i class="pencil alternate icon"></i>
								</button>
								<button
									class="action-btn"
									title="Move Up"
									disabled={idx === 0}
									onclick={() => moveColumnUp(idx)}
								>
									<i class="angle up icon"></i>
								</button>
								<button
									class="action-btn"
									title="Move Down"
									disabled={idx === columns.length - 1}
									onclick={() => moveColumnDown(idx)}
								>
									<i class="angle down icon"></i>
								</button>
								<button
									class="action-btn remove-btn"
									title="Remove Column"
									onclick={() => toggleColumn(col.field)}
								>
									<i class="close icon"></i>
								</button>
							</div>
						</div>
					{/each}
				</div>
			</div>

			<!-- Available Fields Section -->
			<div class="available-section">
				<h4 class="section-title">Available Fields</h4>
				<div class="ui icon input mini fluid search-input" class:inverted>
					<input
						type="text"
						placeholder="Filter fields..."
						bind:value={searchQuery}
					/>
					<i class="search icon"></i>
				</div>
				<div class="column-list scrollable" class:inverted>
					{#if loadingMapping}
						<div class="ui active mini inline loader"></div>
					{:else}
						{#each filteredAvailableFields as field}
							<!-- svelte-ignore a11y_click_events_have_key_events -->
							<!-- svelte-ignore a11y_no_static_element_interactions -->
							<div
								class="column-item available"
								onclick={() => toggleColumn(field)}
							>
								<span class="col-name" title={field}>{field}</span>
								<i class="plus icon add-icon"></i>
							</div>
						{:else}
							<div class="no-fields">No fields found</div>
						{/each}
					{/if}
				</div>
			</div>
		</div>
	{/if}

	<!-- Right Main Table Panel -->
	<div class="table-panel">
		<!-- Toolbar -->
		<div class="table-toolbar" class:inverted>
			<button
				class="ui button mini"
				class:inverted
				onclick={() => (sidebarOpen = !sidebarOpen)}
				title={sidebarOpen ? 'Hide Sidebar' : 'Show Sidebar'}
			>
				<i class="columns icon"></i>
				{sidebarOpen ? 'Hide Columns' : 'Columns'}
			</button>
			<button
				class="ui button mini basic red"
				class:inverted
				onclick={resetColumns}
				title="Reset to default columns"
			>
				<i class="undo icon"></i>
				Reset
			</button>
			<div class="stats-label">
				Showing {sortedResults.length} document{sortedResults.length === 1
					? ''
					: 's'}
			</div>
		</div>

		<!-- Scrollable Table Container -->
		<div class="table-scroll-wrapper">
			{#if isEmpty(sortedResults)}
				<div class="ui placeholder segment center aligned" class:inverted>
					<div class="ui icon header">
						<i class="search icon"></i>
						No search results found
					</div>
				</div>
			{:else}
				<table class="ui celled compact table" class:inverted>
					<thead>
						<tr>
							<th class="expand-header-col"></th>
							{#each columns as col}
								<!-- svelte-ignore a11y_click_events_have_key_events -->
								<!-- svelte-ignore a11y_no_static_element_interactions -->
								<th
									class="sortable-header"
									onclick={() => handleHeaderClick(col.field)}
								>
									<div class="header-content">
										<span>{col.name}</span>
										{#if sortField === col.field}
											<i
												class="sort icon"
												class:up={sortDirection === 'asc'}
												class:down={sortDirection === 'desc'}
											></i>
										{/if}
									</div>
								</th>
							{/each}
						</tr>
					</thead>
					<tbody>
						{#each sortedResults as hit, hitIdx (rowKey(hit))}
							{@const key = rowKey(hit)}
							<tr class="data-row">
								<td class="center aligned expand-cell">
									<button
										class="expand-row-btn"
										onclick={() => toggleRowExpanded(key)}
										title={expandedRows.has(key)
											? 'Collapse row'
											: 'Expand row'}
									>
										<i
											class="caret icon"
											class:right={!expandedRows.has(key)}
											class:down={expandedRows.has(key)}
										></i>
									</button>
								</td>
								{#each columns as col}
									<td class="cell-value" title={col.field}>
										{#if col.field === '_id'}
											<span class="meta-tag">{hit._id}</span>
										{:else if col.field === '_index'}
											<span class="meta-tag index-tag">{hit._index}</span>
										{:else if col.field === '_source'}
											{formatCompactJSON(hit._source)}
										{:else}
											{formatCompactJSON(get(hit._source, col.field))}
										{/if}
									</td>
								{/each}
							</tr>

							<!-- Expanded Row Detail Panel -->
							{#if expandedRows.has(key)}
								<tr class="expanded-row">
									<td></td>
									<td colspan={columns.length} class="detail-container-cell">
										<div class="detail-panel" class:inverted>
											<!-- Detail Tabs Menu -->
											<div class="ui pointing secondary menu" class:inverted>
												<button
													type="button"
													class="item"
													class:active={getRowTab(key) === 'table'}
													onclick={() => (rowTabs[key] = 'table')}
												>
													Table View
												</button>
												<button
													type="button"
													class="item"
													class:active={getRowTab(key) === 'json'}
													onclick={() => (rowTabs[key] = 'json')}
												>
													JSON View
												</button>
												<div class="right menu">
													<button
														class="ui button mini basic compact"
														class:inverted
														onclick={() =>
															copyToClipboard(
																JSON.stringify(hit._source, null, 2)
															)}
													>
														<i class="copy icon"></i> Copy JSON
													</button>
												</div>
											</div>

											<!-- Tab Content -->
											<div class="tab-content">
												{#if getRowTab(hit._id) === 'table'}
													<!-- Flattened key-value table -->
													<div class="flattened-table-wrapper">
														<table
															class="ui very basic compact table flattened-table"
															class:inverted
														>
															<thead>
																<tr>
																	<th width="35%">Field</th>
																	<th width="50%">Value</th>
																	<th width="15%">Actions</th>
																</tr>
															</thead>
															<tbody>
																<!-- _id row -->
																<tr>
																	<td class="field-key">_id</td>
																	<td class="field-val">
																		<span class="meta-tag">{hit._id}</span>
																	</td>
																	<td>
																		<button
																			class="ui button mini compact"
																			class:inverted
																			class:blue={columns.some(
																				c => c.field === '_id'
																			)}
																			onclick={() => toggleColumn('_id')}
																		>
																			{columns.some(c => c.field === '_id')
																				? 'Remove'
																				: 'Add'}
																		</button>
																	</td>
																</tr>
																<!-- _index row -->
																<tr>
																	<td class="field-key">_index</td>
																	<td class="field-val">
																		<span class="meta-tag index-tag"
																			>{hit._index}</span
																		>
																	</td>
																	<td>
																		<button
																			class="ui button mini compact"
																			class:inverted
																			class:blue={columns.some(
																				c => c.field === '_index'
																			)}
																			onclick={() => toggleColumn('_index')}
																		>
																			{columns.some(c => c.field === '_index')
																				? 'Remove'
																				: 'Add'}
																		</button>
																	</td>
																</tr>

																<!-- Flat _source properties -->
																{#each flattenObject(hit._source) as field}
																	<tr>
																		<td class="field-key">{field}</td>
																		<td class="field-val">
																			<code>
																				{JSON.stringify(
																					get(hit._source, field)
																				)}
																			</code>
																		</td>
																		<td>
																			<button
																				class="ui button mini compact"
																				class:inverted
																				class:blue={columns.some(
																					c => c.field === field
																				)}
																				onclick={() => toggleColumn(field)}
																			>
																				{columns.some(c => c.field === field)
																					? 'Remove'
																					: 'Add'}
																			</button>
																		</td>
																	</tr>
																{/each}
															</tbody>
														</table>
													</div>
												{:else}
													<!-- Pretty raw JSON view -->
													<div class="json-code-wrapper">
														<pre><code>{JSON.stringify(
																	hit._source,
																	null,
																	2
																)}</code></pre>
													</div>
												{/if}
											</div>
										</div>
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

	/* Sidebar Panel Styles */
	.sidebar-panel {
		width: 280px;
		border-right: 1px solid #e0e0e0;
		display: flex;
		flex-direction: column;
		padding: 1rem;
		background: #fafafa;
		flex-shrink: 0;

		&.inverted {
			border-color: #555;
			background: #252627;
		}

		.panel-header h3 {
			margin-top: 0;
			margin-bottom: 1rem;
		}

		.section-title {
			margin-top: 0.5rem;
			margin-bottom: 0.5rem;
			font-size: 0.9rem;
			color: #666;
			text-transform: uppercase;
			letter-spacing: 0.5px;
		}

		.selected-section {
			margin-bottom: 1.5rem;
			max-height: 40%;
			display: flex;
			flex-direction: column;

			.column-list {
				overflow-y: auto;
				flex: 1;
				border: 1px solid #e0e0e0;
				border-radius: 4px;
				background: #fff;

				&.inverted {
					border-color: #555;
					background: #1b1c1d;
				}
			}
		}

		.available-section {
			flex: 1;
			display: flex;
			flex-direction: column;
			min-height: 0;

			.search-input {
				margin-bottom: 0.5rem;
			}

			.column-list.scrollable {
				flex: 1;
				overflow-y: auto;
				border: 1px solid #e0e0e0;
				border-radius: 4px;
				background: #fff;

				&.inverted {
					border-color: #555;
					background: #1b1c1d;
				}
			}
		}

		.column-list {
			padding: 4px;
		}

		.column-item {
			display: flex;
			align-items: center;
			justify-content: space-between;
			padding: 6px 8px;
			margin-bottom: 4px;
			border-radius: 3px;
			font-size: 0.85rem;

			&.selected {
				background: #f0f4f8;
				border: 1px solid #d0e0f0;

				&.inverted {
					background: #1e3a5f;
					border-color: #2b5c8f;
					color: #fff;
				}
			}

			&.available {
				cursor: pointer;
				&:hover {
					background: #f5f5f5;
				}
			}

			.col-main {
				flex: 1;
				min-width: 0;
				display: flex;
				align-items: center;
				gap: 4px;
			}

			.rename-input {
				width: 100%;
				padding: 2px 4px;
				font-size: 0.85rem;
				border: 1px solid #2185d0;
				border-radius: 3px;
				outline: none;
			}

			.col-name {
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
				font-weight: 500;
			}

			.col-original {
				font-size: 0.75rem;
				color: #888;
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
			}

			.col-actions {
				display: flex;
				align-items: center;
				gap: 2px;
				flex-shrink: 0;
			}

			.action-btn {
				background: none;
				border: none;
				padding: 2px;
				cursor: pointer;
				color: #777;

				&:hover:not(:disabled) {
					color: #2185d0;
				}

				&:disabled {
					opacity: 0.3;
					cursor: not-allowed;
				}
			}

			.remove-btn:hover {
				color: #db2828 !important;
			}

			.add-icon {
				color: #21ba45;
				font-size: 0.8rem;
				opacity: 0.7;
			}

			&:hover .add-icon {
				opacity: 1;
			}
		}

		.no-fields {
			padding: 10px;
			color: #999;
			text-align: center;
			font-size: 0.85rem;
		}
	}

	/* Table Panel Styles */
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
		}
	}

	.table-scroll-wrapper {
		flex: 1;
		overflow: auto;
	}

	/* Table grid refinements */
	table.table {
		margin: 0 !important;
		border-radius: 0 !important;
		border-left: none !important;
		border-right: none !important;
		border-bottom: none !important;
		table-layout: fixed;
		width: 100%;

		th {
			position: sticky;
			top: 0;
			z-index: 10;
			background: #f9fafb !important;
			box-shadow: 0 1px 0 #d4d4d5;
		}

		&.inverted th {
			background: #202122 !important;
			box-shadow: 0 1px 0 #555;
			color: #fff !important;
		}

		.sortable-header {
			cursor: pointer;
			user-select: none;

			&:hover {
				background: #f2f2f2 !important;
			}
		}

		&.inverted .sortable-header:hover {
			background: #2d2e2f !important;
		}

		.header-content {
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: 6px;
		}

		.expand-header-col {
			width: 45px;
		}

		.expand-cell {
			width: 45px;
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

		.cell-value {
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
			font-size: 0.85rem;
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

	/* Expanded Details Styles */
	.expanded-row {
		background: #f9f9f9 !important;

		&:hover {
			background: #f9f9f9 !important;
		}
	}

	:global(.inverted) .expanded-row {
		background: #161718 !important;

		&:hover {
			background: #161718 !important;
		}
	}

	.detail-container-cell {
		padding: 1.2rem !important;
		border-top: none !important;
	}

	.detail-panel {
		background: #fff;
		border: 1px solid #d4d4d5;
		border-radius: 4px;
		padding: 1rem;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);

		&.inverted {
			background: #1f2021;
			border-color: #555;
			box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
		}

		.menu {
			margin-bottom: 1rem !important;
		}

		.tab-content {
			min-height: 150px;
		}
	}

	/* Flattened field table styling */
	.flattened-table-wrapper {
		max-height: 400px;
		overflow-y: auto;
		border: 1px solid #f0f0f0;
		border-radius: 4px;
	}

	.flattened-table {
		margin: 0 !important;

		td {
			padding: 8px 12px !important;
			vertical-align: middle !important;
		}

		.field-key {
			font-weight: bold;
			color: #333;
			font-family: monospace;
			font-size: 0.85rem;
		}

		.field-val {
			word-break: break-all;
			font-size: 0.85rem;

			code {
				background: #f7f7f7;
				padding: 2px 4px;
				border-radius: 3px;
				border: 1px solid #e0e0e0;
			}
		}
	}

	:global(.inverted) {
		.flattened-table {
			.field-key {
				color: #ddd;
			}

			.field-val code {
				background: #2b2b2b;
				border-color: #444;
				color: #eee;
			}
		}
	}

	/* JSON raw display styling */
	.json-code-wrapper {
		max-height: 400px;
		overflow: auto;
		background: #f7f7f7;
		border: 1px solid #e0e0e0;
		border-radius: 4px;
		padding: 1rem;

		pre {
			margin: 0;
		}

		code {
			font-family: monospace;
			font-size: 0.85rem;
			white-space: pre-wrap;
			word-wrap: break-word;
		}
	}

	:global(.inverted) .json-code-wrapper {
		background: #111;
		border-color: #444;
		color: #21ba45;
	}
</style>
