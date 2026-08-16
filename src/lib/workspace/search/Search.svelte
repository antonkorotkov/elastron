<script>
	import isEqual from 'lodash/isEqual'
	import { useStoreon } from '@storeon/svelte'
	import { onMount, onDestroy } from 'svelte'
	import isEmpty from 'lodash/isEmpty'
	import isNumber from 'lodash/isNumber'

	import IndexSelector from '../../components/inputs/IndexSelector.svelte'
	import EditControls from './EditControls.svelte'
	import SearchControls from './SearchControls.svelte'
	import ProfileTable from './ProfileTable.svelte'
	import ResultsTable from './ResultsTable.svelte'
	import {
		invalidJsonBodyMessage,
		isThemeToggleChecked,
		parseJsonBody,
	} from '../../utils/helpers'

	const { dispatch, search, app } = useStoreon('search', 'app')

	let requestBodyEditor, resultsEditor
	let qEditor = $state()
	let rEditor = $state()

	let inverted = $derived(isThemeToggleChecked($app.theme))

	const notifyError = error =>
		dispatch('notification/add', {
			type: 'error',
			message: error.message,
		})

	const onEditorChange = () => {
		try {
			if (qEditor) {
				const requestBody = qEditor.get()
				dispatch('search/update', { requestBody })
			}
		} catch (err) {
			// Malformed JSON is expected while typing — the store keeps the last
			// valid body and `onSearchRun` re-validates before running a query.
		}
	}

	/**
	 * Read the request body straight from the editor so a query never runs with
	 * a stale body. Reports malformed JSON and returns `{ error }` instead.
	 */
	const readRequestBody = () => {
		try {
			return { requestBody: parseJsonBody(qEditor.getText()) }
		} catch (error) {
			dispatch('notification/add', {
				type: 'error',
				message: invalidJsonBodyMessage(error),
			})
			return { error }
		}
	}

	const onDocTypeChange = e => {
		const docType = e.target.value.trim() || '_doc'
		dispatch('search/update', { docType })
		e.target.value = docType
	}

	const onSearchRun = e => {
		if ($search.type === 'body' && qEditor) {
			const { requestBody, error } = readRequestBody()
			if (error) return
			dispatch('search/update', { requestBody })
		}

		if ($search.view === 'edit') {
			dispatch('search/update', {
				view: 'hits',
			})
		}
		dispatch('search/run')
	}

	const onStateFieldChange = data => dispatch('search/update', data)

	const onSizeChange = e => {
		const size =
			!e.target.value.trim() || Number(e.target.value.trim()) < 0
				? 10
				: Number(e.target.value.trim())
		dispatch('search/update', { size })
		e.target.value = size
	}

	const onFromChange = e => {
		const from =
			!e.target.value.trim() || Number(e.target.value.trim()) < 0
				? 0
				: Number(e.target.value.trim())
		dispatch('search/update', { from })
		e.target.value = from
	}

	const onClickRemove = index => {
		if (
			confirm('Are you sure you want to delete this document from the index?')
		)
			dispatch('search/documents/delete', index)
	}

	let canEditDoc = $state(false)
	const onClickEditDocument = index => {
		if (isEmpty($search.results[index]?._source)) {
			return dispatch('notification/add', {
				type: 'error',
				message: 'Document must have `_source` field in order to be edited',
			})
		}
		dispatch('search/update', { editDoc: $search.results[index] })
		canEditDoc = false
		switchView('edit')
	}

	onMount(async () => {
		try {
			await createEditors()
		} catch (error) {
			notifyError(error)
		}
	})

	const createEditors = async () => {
		const { default: JSONEditor } = await import('jsoneditor')
		await import('jsoneditor/dist/jsoneditor.min.css')

		if (requestBodyEditor) {
			qEditor = new JSONEditor(
				requestBodyEditor,
				{
					mode: 'code',
					onChange: onEditorChange,
				},
				$search.requestBody
			)
		}

		if (resultsEditor) {
			rEditor = new JSONEditor(
				resultsEditor,
				{
					mode: 'tree',
					onChange: () => {
						try {
							rEditor.get()
							canEditDoc = true
						} catch (e) {
							canEditDoc = false
						}
					},
					onEditable: function () {
						if (rEditor && rEditor.getMode() == 'code') return true
						return false
					},
					onEvent: (node, event) => {
						if (event.type === 'mouseover') {
							if (event.target.tagName.toLowerCase() === 'a') {
								event.target.target = '_blank'
							}
						}
					},
					onCreateMenu: (__, node) => {
						if (
							node.type === 'single' &&
							isNumber(node.path[0]) &&
							node.path.length === 1
						) {
							return [
								{
									text: 'Edit',
									title: 'Edit the document and commit updates to the server',
									className: 'jsoneditor-type-object',
									click: () => onClickEditDocument(node.path[0]),
								},
								{
									text: 'Delete',
									title: 'Delete the document from the server',
									className: 'jsoneditor-remove',
									click: () => onClickRemove(node.path[0]),
								},
							]
						}
						return []
					},
				},
				$search.results
			)
		}
	}

	let prevView = 'hits'
	$effect(() => {
		try {
			if (rEditor) {
				let json = {}
				switch ($search.view) {
					case 'hits':
						json = $search.results
						rEditor.setMode('tree')
						break
					case 'aggs':
						json = !isEmpty($search.aggs) ? $search.aggs : $search.results
						rEditor.setMode('tree')
						break
					case 'raw':
						json = !isEmpty($search.response)
							? $search.response
							: $search.results
						rEditor.setMode('tree')
						break
					case 'edit':
						json = !isEmpty($search.editDoc) ? $search.editDoc._source : {}
						rEditor.setMode('code')
						rEditor.aceEditor.setOptions({ maxLines: 100 })
						break
					default:
						return
				}

				if (!isEqual(rEditor.get(), json)) {
					if ($search.view != prevView) rEditor.set(json)
					else {
						if ($search.view !== 'edit') rEditor.update(json)
					}
				}

				prevView = $search.view
			}
		} catch (e) {
			// `rEditor.get()` throws while the user is editing a document into
			// invalid JSON; the view sync simply waits for it to become valid.
		}
	})

	onDestroy(() => {
		if (qEditor) {
			qEditor.destroy()
		}
		if (rEditor) {
			rEditor.destroy()
		}
	})

	/**
	 * Toggle a boolean flag inside the request body. Needs parseable JSON, so a
	 * malformed body is reported instead of throwing out of the event handler.
	 */
	const toggleRequestBodyFlag = (flag, checked, stateField) => {
		const { requestBody, error } = readRequestBody()
		if (error) return

		if (checked) {
			requestBody[flag] = true
		} else {
			delete requestBody[flag]
		}

		try {
			qEditor.set(requestBody)
			dispatch('search/update', { requestBody })
			onStateFieldChange({ [stateField]: checked })
		} catch (err) {
			notifyError(err)
		}
	}

	const onProfilingChanged = checked =>
		toggleRequestBodyFlag('profile', checked, 'profiling')

	const onExplainChanged = checked =>
		toggleRequestBodyFlag('explain', checked, 'explain')

	const switchView = view => {
		dispatch('search/update', { view })
	}
</script>

<div class="ui segments playground-container">
	<div class="ui segment" class:inverted>
		<div class="ui form" class:inverted>
			<div class="fields search-options">
				<div class="field">
					<label for="type">Search Type</label>
					<select
						id="type"
						class="ui dropdown"
						onchange={e => onStateFieldChange({ type: e.target.value })}
						value={$search.type}
					>
						<option value="uri">URI Search</option>
						<option value="body">Request Body</option>
					</select>
				</div>
				<div class="field themed" id="indexSelect">
					<label for="index">Index</label>
					<IndexSelector
						containerStyle="min-width:300px;"
						allowCustom={true}
						currentlySelected={$search.index}
						onSelect={e => onStateFieldChange({ index: e.detail.value })}
						onClear={() => onStateFieldChange({ index: '_all' })}
					/>
				</div>

				{#if $search.type === 'body'}
					<div class="field">
						<label for="run">&nbsp;</label>
						<button
							class="ui green button"
							class:inverted
							class:loading={$search.loading}
							disabled={$search.loading}
							onclick={onSearchRun}
						>
							Run
						</button>
					</div>
				{/if}

				{#if $search.type === 'uri'}
					<div class="field">
						<label for="size">Size</label>
						<input
							type="number"
							id="size"
							onchange={onSizeChange}
							value={$search.size}
						/>
					</div>
					<div class="field">
						<label for="from">From</label>
						<input
							type="number"
							id="from"
							onchange={onFromChange}
							value={$search.from}
						/>
					</div>
					<div class="field">
						<label for="sort">Sort</label>
						<input
							type="text"
							id="sort"
							onchange={e =>
								onStateFieldChange({
									sort: e.target.value.trim(),
								})}
							value={$search.sort}
						/>
					</div>

					<div class="field">
						<label for="source">_Source</label>
						<div class="ui checkbox">
							<input
								id="source"
								type="checkbox"
								onchange={e =>
									onStateFieldChange({
										useSource: e.target.checked,
									})}
								checked={$search.useSource}
							/>
							<label for="source">Enable</label>
						</div>
					</div>

					{#if $search.useSource}
						<div class="field">
							<label for="source-value">&nbsp;</label>
							<input
								type="text"
								id="source-value"
								onchange={e => onStateFieldChange({ _source: e.target.value })}
								value={$search._source}
							/>
						</div>
					{/if}
				{/if}

				<div class="field">
					<label for="use-doc-type">Doc Type</label>
					<div class="ui checkbox">
						<input
							id="use-doc-type"
							type="checkbox"
							onchange={e =>
								onStateFieldChange({
									useDocType: e.target.checked,
								})}
							checked={$search.useDocType}
						/>
						<label for="use-doc-type">Enable</label>
					</div>
				</div>

				{#if $search.useDocType}
					<div class="field">
						<label for="type-value">&nbsp;</label>
						<input
							type="text"
							id="type-value"
							onchange={onDocTypeChange}
							value={$search.docType}
						/>
					</div>
				{/if}

				<div class="field">
					<label for="explain">Explain</label>
					<div class="ui checkbox">
						<input
							id="explain"
							type="checkbox"
							onchange={e => onExplainChanged(e.target.checked)}
							checked={$search.explain}
						/>
						<label for="explain">Enable</label>
					</div>
				</div>

				{#if $search.type === 'body'}
					<div class="field">
						<label for="profiling">Profiling</label>
						<div class="ui checkbox">
							<input
								id="profiling"
								type="checkbox"
								onchange={e => onProfilingChanged(e.target.checked)}
								checked={$search.profiling}
							/>
							<label for="profiling">Enable</label>
						</div>
					</div>
				{/if}
			</div>
			<div class="field" class:hidden={$search.type !== 'uri'}>
				<label for="uri">URI Query</label>
				<div class="ui fluid action input">
					<input
						id="uri"
						type="text"
						onchange={e => onStateFieldChange({ uriQuery: e.target.value })}
						onkeyup={e => (e.keyCode == 13 ? onSearchRun() : null)}
						value={$search.uriQuery}
					/>
					<button
						class="ui green button"
						class:inverted
						class:loading={$search.loading}
						disabled={$search.loading}
						onclick={onSearchRun}
					>
						Run
					</button>
				</div>
			</div>
		</div>
	</div>

	<div class="ui segment" class:inverted>
		{#if $search.view === 'edit' && $search.editDoc}
			<EditControls {canEditDoc} {rEditor} />
		{:else}
			<SearchControls {qEditor} />
		{/if}
	</div>

	<div class="ui segment split-view" class:inverted>
		<div class="editor-panel" class:hidden={$search.type !== 'body'}>
			<div class="editor-wrapper">
				<div id="request-body-editor" bind:this={requestBodyEditor}></div>
			</div>
		</div>

		<div class="editor-panel">
			{#if $search.view === 'profile'}
				<div class="editor-wrapper" style="overflow-y: auto;">
					<ProfileTable />
				</div>
			{/if}
			<div class="editor-wrapper" class:hidden={$search.view !== 'table'}>
				<ResultsTable />
			</div>
			<div
				class="editor-wrapper"
				class:hidden={$search.view === 'table' || $search.view === 'profile'}
			>
				<div id="results-editor" bind:this={resultsEditor}></div>
			</div>
		</div>
	</div>
</div>

<style>
	.hidden {
		display: none !important;
	}

	.search-options input[type='number'] {
		width: 6rem !important;
	}

	.search-options {
		margin-bottom: 0 !important;
	}

	.themed {
		min-width: 190px;
	}

	.playground-container {
		display: flex;
		flex-direction: column;
		height: calc(100vh - 130px);
		border-radius: 4px;
	}
	.split-view {
		flex: 1;
		display: flex;
		gap: 1rem;
		min-height: 0;
		padding: 1rem !important;
	}
	.editor-panel {
		flex: 1;
		display: flex;
		flex-direction: column;
		border: 1px solid #e0e0e0;
		border-radius: 4px;
		background: #fff;
		overflow: hidden;
	}
	:global(.inverted) .editor-panel {
		border-color: #555;
		background: #1b1c1d;
	}
	.editor-wrapper {
		flex: 1;
		position: relative;
		overflow: hidden;
	}
	:global(#request-body-editor),
	:global(#results-editor) {
		height: 100%;
		border: none;
	}
	:global(.jsoneditor) {
		border: none !important;
	}
</style>
