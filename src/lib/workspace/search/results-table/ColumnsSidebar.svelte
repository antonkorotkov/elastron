<script>
	/**
	 * @typedef {Object} Props
	 * @property {{ field: string, name: string, width?: number }[]} columns
	 * @property {string[]} availableFields every field that can become a column
	 * @property {boolean} [loading]
	 * @property {boolean} [inverted]
	 * @property {(field: string) => void} onToggle
	 * @property {(from: number, to: number) => void} onMove
	 * @property {(field: string, name: string) => void} onRename
	 * @property {() => void} onReset
	 */

	/** @type {Props} */
	let {
		columns,
		availableFields,
		loading = false,
		inverted = false,
		onToggle,
		onMove,
		onRename,
		onReset,
	} = $props()

	let query = $state('')
	let editingField = $state(null)
	let renameValue = $state('')

	let selectedFields = $derived(new Set(columns.map(column => column.field)))

	let filtered = $derived(
		availableFields.filter(
			field =>
				!selectedFields.has(field) &&
				field.toLowerCase().includes(query.trim().toLowerCase())
		)
	)

	const startRename = column => {
		editingField = column.field
		renameValue = column.name
	}

	/**
	 * Committing clears `editingField`, which unmounts the input and fires its
	 * own blur — the guard keeps that from dispatching a second identical save.
	 */
	const commitRename = field => {
		if (editingField !== field) return
		editingField = null
		onRename(field, renameValue)
	}

	const cancelRename = () => {
		editingField = null
		renameValue = ''
	}

	const onRenameKeydown = (event, field) => {
		if (event.key === 'Enter') {
			event.preventDefault()
			commitRename(field)
		} else if (event.key === 'Escape') {
			event.preventDefault()
			cancelRename()
		}
	}

	const autofocus = node => node.focus()
</script>

<div class="sidebar-panel" class:inverted>
	<div class="panel-header">
		<h3 class="ui small header" class:inverted>Columns</h3>
		<button
			class="ui button mini basic"
			class:inverted
			title="Reset to default columns"
			onclick={onReset}
		>
			<i class="undo icon"></i>
			Reset
		</button>
	</div>

	<div class="selected-section">
		<h4 class="section-title">Selected ({columns.length})</h4>
		<div class="column-list scrollable" class:inverted>
			{#each columns as column, idx (column.field)}
				<div class="column-item selected" class:inverted>
					<div class="col-main">
						{#if editingField === column.field}
							<input
								type="text"
								class="rename-input"
								class:inverted
								aria-label="New name for column {column.field}"
								bind:value={renameValue}
								onblur={() => commitRename(column.field)}
								onkeydown={event => onRenameKeydown(event, column.field)}
								use:autofocus
							/>
						{:else}
							<span class="col-name" title={column.field}>{column.name}</span>
							{#if column.field !== column.name}
								<span class="col-original" title={column.field}>
									({column.field})
								</span>
							{/if}
						{/if}
					</div>
					<div class="col-actions">
						<button
							class="action-btn"
							title="Rename column"
							aria-label="Rename column {column.field}"
							onclick={() => startRename(column)}
						>
							<i class="pencil alternate icon"></i>
						</button>
						<button
							class="action-btn"
							title="Move up"
							aria-label="Move column {column.field} up"
							disabled={idx === 0}
							onclick={() => onMove(idx, idx - 1)}
						>
							<i class="angle up icon"></i>
						</button>
						<button
							class="action-btn"
							title="Move down"
							aria-label="Move column {column.field} down"
							disabled={idx === columns.length - 1}
							onclick={() => onMove(idx, idx + 1)}
						>
							<i class="angle down icon"></i>
						</button>
						<button
							class="action-btn remove-btn"
							title="Remove column"
							aria-label="Remove column {column.field}"
							onclick={() => onToggle(column.field)}
						>
							<i class="close icon"></i>
						</button>
					</div>
				</div>
			{/each}
		</div>
	</div>

	<div class="available-section">
		<h4 class="section-title">Available Fields</h4>
		<div class="ui icon input mini fluid search-input" class:inverted>
			<input
				type="text"
				aria-label="Filter fields"
				placeholder="Filter fields..."
				bind:value={query}
			/>
			<i class="search icon"></i>
		</div>
		<div class="column-list scrollable" class:inverted>
			{#if loading}
				<div class="ui active mini inline loader"></div>
			{:else}
				{#each filtered as field (field)}
					<button
						type="button"
						class="column-item available"
						class:inverted
						title="Add {field} as a column"
						onclick={() => onToggle(field)}
					>
						<span class="col-name">{field}</span>
						<i class="plus icon add-icon"></i>
					</button>
				{:else}
					<div class="no-fields">No fields found</div>
				{/each}
			{/if}
		</div>
	</div>
</div>

<style lang="scss">
	.sidebar-panel {
		width: 280px;
		border-right: 1px solid #e0e0e0;
		display: flex;
		flex-direction: column;
		padding: 1rem;
		background: #fafafa;
		flex-shrink: 0;
		min-height: 0;

		&.inverted {
			border-color: #555;
			background: #252627;
		}
	}

	.panel-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		margin-bottom: 1rem;

		h3 {
			margin: 0;
		}
	}

	.section-title {
		margin-top: 0.5rem;
		margin-bottom: 0.5rem;
		font-size: 0.9rem;
		color: #666;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.sidebar-panel.inverted .section-title {
		color: #aaa;
	}

	.selected-section {
		margin-bottom: 1.5rem;
		max-height: 40%;
		display: flex;
		flex-direction: column;
		min-height: 0;
	}

	.available-section {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-height: 0;

		.search-input {
			margin-bottom: 0.5rem;
		}
	}

	.column-list {
		padding: 4px;

		&.scrollable {
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

	.column-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 4px;
		padding: 6px 8px;
		margin-bottom: 4px;
		border-radius: 3px;
		font-size: 0.85rem;
		width: 100%;
		text-align: left;

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
			border: 1px solid transparent;
			background: none;
			cursor: pointer;
			font: inherit;
			color: inherit;

			&:hover {
				background: #f5f5f5;
			}

			&.inverted {
				color: #eee;

				&:hover {
					background: #2d2e2f;
				}
			}
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

		&.inverted {
			background: #1b1c1d;
			color: #fff;
		}
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

	.column-item.inverted .action-btn {
		color: #ccc;
	}

	.remove-btn:hover:not(:disabled) {
		color: #db2828 !important;
	}

	.add-icon {
		color: #21ba45;
		font-size: 0.8rem;
		opacity: 0.7;
		flex-shrink: 0;
	}

	.column-item:hover .add-icon {
		opacity: 1;
	}

	.no-fields {
		padding: 10px;
		color: #999;
		text-align: center;
		font-size: 0.85rem;
	}
</style>
