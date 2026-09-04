<script>
	import {
		cellValue,
		flattenObject,
		DETAIL_MAX_FIELDS,
		DETAIL_MAX_JSON_LINES,
	} from '../../../utils/tableHelpers'

	/**
	 * @typedef {Object} Props
	 * @property {object} hit
	 * @property {{ field: string }[]} columns
	 * @property {'table'|'json'} [tab]
	 * @property {boolean} [inverted]
	 * @property {(tab: 'table'|'json') => void} onTab
	 * @property {(field: string) => void} onToggleColumn
	 * @property {(text: string) => void} onCopy
	 */

	/** @type {Props} */
	let {
		hit,
		columns,
		tab = 'table',
		inverted = false,
		onTab,
		onToggleColumn,
		onCopy,
	} = $props()

	let selectedFields = $derived(new Set(columns.map(column => column.field)))

	// Metadata first, then the document's own fields, so the two things a row
	// can be identified by are always at the top. Deduped because a `_source`
	// is free to carry its own `_id` (common after a reindex) and the list is
	// rendered as a keyed each block.
	let fields = $derived([
		...new Set(['_id', '_index', '_score', ...flattenObject(hit?._source)]),
	])

	let sourceJson = $derived(JSON.stringify(hit?._source ?? {}, null, 2))
	let sourceJsonLines = $derived(sourceJson.split('\n'))

	let fieldsRevealed = $state(false)
	let jsonRevealed = $state(false)

	let hiddenFieldCount = $derived(Math.max(0, fields.length - DETAIL_MAX_FIELDS))
	let visibleFields = $derived(
		fieldsRevealed ? fields : fields.slice(0, DETAIL_MAX_FIELDS)
	)

	let hiddenJsonLineCount = $derived(
		Math.max(0, sourceJsonLines.length - DETAIL_MAX_JSON_LINES)
	)
	let visibleJson = $derived(
		jsonRevealed
			? sourceJson
			: sourceJsonLines.slice(0, DETAIL_MAX_JSON_LINES).join('\n')
	)

	const displayValue = field => {
		const value = cellValue(hit, field)
		return value === undefined ? '' : JSON.stringify(value)
	}
</script>

<div class="detail-panel" class:inverted>
	<div class="ui pointing secondary menu" class:inverted>
		<button
			type="button"
			class="item"
			class:active={tab === 'table'}
			onclick={() => onTab('table')}
		>
			Table View
		</button>
		<button
			type="button"
			class="item"
			class:active={tab === 'json'}
			onclick={() => onTab('json')}
		>
			JSON View
		</button>
		<div class="right menu">
			<button
				class="ui button mini basic compact"
				class:inverted
				onclick={() => onCopy(sourceJson)}
			>
				<i class="copy icon"></i> Copy JSON
			</button>
		</div>
	</div>

	<div class="tab-content">
		{#if tab === 'table'}
			<div class="flattened-table-wrapper" class:inverted>
				<table class="ui very basic compact table flattened-table" class:inverted>
					<thead>
						<tr>
							<th style="width: 35%">Field</th>
							<th style="width: 50%">Value</th>
							<th style="width: 15%">Actions</th>
						</tr>
					</thead>
					<tbody>
						{#each visibleFields as field (field)}
							<tr>
								<td class="field-key">{field}</td>
								<td class="field-val">
									{#if field === '_id' || field === '_index'}
										<span class="meta-tag" class:index-tag={field === '_index'}>
											{cellValue(hit, field)}
										</span>
									{:else}
										<code>{displayValue(field)}</code>
									{/if}
								</td>
								<td>
									<button
										class="ui button mini compact"
										class:inverted
										class:blue={selectedFields.has(field)}
										onclick={() => onToggleColumn(field)}
									>
										{selectedFields.has(field) ? 'Remove' : 'Add'}
									</button>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
			{#if !fieldsRevealed && hiddenFieldCount > 0}
				<button
					type="button"
					class="ui button mini basic compact reveal-button"
					class:inverted
					onclick={() => (fieldsRevealed = true)}
				>
					Show {hiddenFieldCount} more field{hiddenFieldCount === 1 ? '' : 's'}
				</button>
			{/if}
		{:else}
			<div class="json-code-wrapper" class:inverted>
				<pre><code>{visibleJson}</code></pre>
			</div>
			{#if !jsonRevealed && hiddenJsonLineCount > 0}
				<button
					type="button"
					class="ui button mini basic compact reveal-button"
					class:inverted
					onclick={() => (jsonRevealed = true)}
				>
					Show {hiddenJsonLineCount} more line{hiddenJsonLineCount === 1 ? '' : 's'}
				</button>
			{/if}
		{/if}
	</div>
</div>

<style lang="scss">
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

	.flattened-table-wrapper {
		border: 1px solid #f0f0f0;
		border-radius: 4px;

		&.inverted {
			border-color: #444;
		}
	}

	.reveal-button {
		margin-top: 0.75rem !important;
	}

	.flattened-table {
		margin: 0 !important;

		// This table is nested inside the results table, and Semantic's table
		// rules are descendant selectors — `.ui.celled.table tr th` reaches in
		// and borders these cells as though they belonged to the outer grid,
		// while `very basic` strips the header's own padding to zero. Both have
		// to be restated here rather than inherited.
		th,
		td {
			padding: 8px 12px !important;
			border-left: none !important;
			vertical-align: middle !important;
		}

		.field-key {
			font-weight: bold;
			color: #333;
			font-family: monospace;
			font-size: 0.85rem;
			word-break: break-all;
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

		&.inverted {
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

	.inverted .meta-tag {
		background: #444;
		color: #eee;

		&.index-tag {
			background: #1e3a5f;
			color: #8faec4;
		}
	}

	.json-code-wrapper {
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

		&.inverted {
			background: #111;
			border-color: #444;
			color: #eee;
		}
	}
</style>
