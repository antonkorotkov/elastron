<script>
	import isEqual from 'lodash/isEqual'
	import JSONEditor from 'jsoneditor'
	import { useStoreon } from '@storeon/svelte'
	import { onMount, onDestroy } from 'svelte'
	import isEmpty from 'lodash/isEmpty'
	import isNumber from 'lodash/isNumber'

	import IndexSelector from '../../components/inputs/IndexSelector.svelte'
	import EditControls from './EditControls.svelte'
	import SearchControls from './SearchControls.svelte'
	import ProfileTable from './ProfileTable.svelte'
	import { isThemeToggleChecked } from '../../utils/helpers'

	import 'jsoneditor/dist/jsoneditor.min.css'

	const { dispatch, search, app } = useStoreon('search', 'app')

	let requestBodyEditor, resultsEditor
	let qEditor = $state()
	let rEditor = $state()

	let inverted = $derived(isThemeToggleChecked($app.theme))

	const onEditorChange = () => {
		try {
			if (qEditor) {
				const requestBody = qEditor.get()
				dispatch('search/update', { requestBody })
			}
		} catch (err) {}
	}

	const onDocTypeChange = e => {
		const docType = e.target.value.trim() || '_doc'
		dispatch('search/update', { docType })
		e.target.value = docType
	}

	const onSearchRun = e => {
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
		if (isEmpty($search.results[index]._source)) {
			return dispatch('notification/add', {
				type: 'error',
				message: 'Document must have `_source` field in order to be edited',
			})
		}
		dispatch('search/update', { editDoc: $search.results[index] })
		canEditDoc = false
		switchView('edit')
	}

	onMount(() => {
		if (requestBodyEditor) {
			qEditor = new JSONEditor(
				requestBodyEditor,
				{
					mode: 'code',
					onChange: onEditorChange,
				},
				$search.requestBody
			)
			qEditor.aceEditor.setOptions({ maxLines: 32 })
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
	})

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
		} catch (e) {}
	})

	onDestroy(() => {
		if (qEditor) {
			qEditor.destroy()
		}
		if (rEditor) {
			rEditor.destroy()
		}
	})

	const onProfilingChanged = checked => {
		const requestBody = qEditor.get()
		if (checked) {
			requestBody.profile = true
		} else {
			delete requestBody.profile
		}
		qEditor.set(requestBody)
		dispatch('search/update', { requestBody })
		onStateFieldChange({ profiling: checked })
	}

	const onExplainChanged = checked => {
		const requestBody = qEditor.get()
		if (checked) {
			requestBody.explain = true
		} else {
			delete requestBody.explain
		}
		qEditor.set(requestBody)
		dispatch('search/update', { requestBody })
		onStateFieldChange({ explain: checked })
	}

	const switchView = view => {
		dispatch('search/update', { view })
	}
</script>

<div class="ui segments">
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
			<div class="field" class:hidden={$search.type !== 'body'}>
				<div id="request-body-editor" bind:this={requestBodyEditor}></div>
			</div>
			{#if $search.type === 'body'}
				<button
					class="ui green button"
					class:inverted
					class:loading={$search.loading}
					disabled={$search.loading}
					onclick={onSearchRun}
				>
					Run
				</button>
			{/if}
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
		{#if $search.view === 'profile'}
			<ProfileTable />
		{/if}
		<div
			hidden={$search.view === 'profile'}
			id="results-editor"
			bind:this={resultsEditor}
		></div>
	</div>
</div>

<style>
	.hidden {
		display: none;
	}

	.search-options input[type='number'] {
		width: 6rem !important;
	}

	.themed {
		min-width: 190px;
	}
</style>
