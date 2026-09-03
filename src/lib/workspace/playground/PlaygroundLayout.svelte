<script>
	import isEqual from 'lodash/isEqual'
	import { useStoreon } from '@storeon/svelte'
	import API from '$lib/api/elasticsearch'
	import JsonEditor from '$lib/components/JsonEditor.svelte'
	import KeyValueList from './KeyValueList.svelte'
	import IndexSelector from '$lib/components/inputs/IndexSelector.svelte'
	import TemplateDrawer from './TemplateDrawer.svelte'
	import {
		invalidJsonBodyMessage,
		isThemeToggleChecked,
		parseJsonBody,
	} from '../../utils/helpers'

	const { dispatch, connection, playground, app } = useStoreon(
		'connection',
		'playground',
		'app'
	)

	let requestEditor = $state(null)

	let method = $derived($playground.draft.method)
	let path = $derived($playground.draft.path)
	let activeTab = $derived($playground.draft.activeTab)
	let selectedIndex = $derived($playground.selectedIndex)
	let responseBody = $derived($playground.responseBody)
	let isRequestLoading = $derived($playground.isRequestLoading)

	let isDrawerOpen = $derived($playground.isDrawerOpen)
	let inverted = $derived(isThemeToggleChecked($app.theme))

	let showSaveInput = $state(false)
	let templateName = $state('')

	const notifyError = message =>
		dispatch('notification/add', { type: 'error', message })

	/**
	 * Parse the current draft's body text. Reports malformed JSON and returns
	 * `{ error }` instead of throwing out of an event handler.
	 */
	const readRequestBody = () => {
		try {
			return { body: parseJsonBody($playground.draft.bodyText) }
		} catch (error) {
			notifyError(invalidJsonBodyMessage(error))
			return { error }
		}
	}

	const saveTemplate = () => {
		if (templateName.trim()) {
			const { body, error } = readRequestBody()
			if (error) return

			dispatch('playground/saveTemplate', {
				name: templateName.trim(),
				method,
				path,
				body,
				headers: $playground.draft.headers,
			})
			templateName = ''
			showSaveInput = false
		}
	}

	// The JSON body editor is uncontrolled: it owns the text while the user
	// types, and only gets pushed a new value when the store's bodyText
	// diverges from what the editor is last known to hold — on hydrate
	// (which can land after mount) and on template load. A value that
	// originated from the editor's own `onChangeText` always matches, so this
	// never fights the cursor mid-edit.
	let lastEditorText = null
	$effect(() => {
		const bodyText = $playground.draft.bodyText
		if (requestEditor && bodyText !== lastEditorText) {
			lastEditorText = bodyText
			requestEditor.setText(bodyText)
		}
	})

	// KeyValueList needs a deeply-mutable array to back its per-row
	// checkbox/text bindings, which a plain object from the store cannot be.
	// `headerItems` is that local buffer: reseeded from the store whenever the
	// store's headers are a genuinely different array (hydrate, template
	// load), and mirrored back to the store whenever its contents diverge
	// from what was last synced (the user editing a row). Both directions
	// compare by content (`isEqual`), not reference, so this stays correct
	// even if `playground/update` starts cloning `headers` instead of storing
	// the patch by reference.
	let lastSyncedHeaders = $playground.draft.headers || []
	let headerItems = $state(lastSyncedHeaders.map(h => ({ ...h })))

	$effect(() => {
		const stored = $playground.draft.headers || []
		if (!isEqual(stored, lastSyncedHeaders)) {
			lastSyncedHeaders = stored
			headerItems = stored.map(h => ({ ...h }))
		}
	})

	$effect(() => {
		const snapshot = headerItems.map(h => ({
			key: h.key,
			value: h.value,
			enabled: h.enabled,
		}))
		if (!isEqual(snapshot, lastSyncedHeaders)) {
			lastSyncedHeaders = snapshot
			dispatch('playground/update', { headers: snapshot })
		}
	})

	let requestEditorOptions = {
		mode: 'code',
		modes: ['code', 'tree'],
		onChangeText: text => {
			lastEditorText = text
			dispatch('playground/update', { bodyText: text })
		},
	}

	let responseEditorOptions = {
		mode: 'view',
		modes: ['view', 'code', 'tree'],
	}

	const sendRequest = async () => {
		if (!$connection) return

		const { body, error } = readRequestBody()
		if (error) return

		// Captured so a response arriving after the user has switched
		// connections is discarded instead of repopulating the just-cleared
		// response pane with data from the connection they left.
		const requestConnection = $connection

		try {
			dispatch('playground/update', { isRequestLoading: true })

			const api = new API(requestConnection)

			let customHeaders = {}
			for (const { key, value, enabled } of $playground.draft.headers) {
				if (enabled && key) {
					customHeaders[key] = value
				}
			}

			let resolvedPath = path
			if (resolvedPath.includes('{{index}}')) {
				if (selectedIndex) {
					resolvedPath = resolvedPath.replaceAll('{{index}}', selectedIndex)
				} else {
					resolvedPath = resolvedPath
						.replaceAll('{{index}}/', '')
						.replaceAll('{{index}}', '')
				}
				if (resolvedPath === '') resolvedPath = '/'
				if (!resolvedPath.startsWith('/')) resolvedPath = '/' + resolvedPath
			}

			const response = await api.genericRequest({
				method,
				path: resolvedPath,
				elasticBody: Object.keys(body).length > 0 ? body : undefined,
				headers:
					Object.keys(customHeaders).length > 0 ? customHeaders : undefined,
			})
			if ($connection === requestConnection) {
				dispatch('playground/update', { responseBody: response })
			}
		} catch (error) {
			if ($connection === requestConnection) {
				try {
					dispatch('playground/update', { responseBody: JSON.parse(error.message) })
				} catch {
					dispatch('playground/update', { responseBody: { error: error.message } })
					notifyError(error.message)
				}
			}
		} finally {
			dispatch('playground/update', { isRequestLoading: false })
		}
	}
</script>

<div class="ui segments playground-container">
	<div class="ui segment" class:inverted>
		<div class="ui form" class:inverted>
			<div class="fields top-bar">
				<div class="field" style="width: 120px;">
					<label for="method">Method</label>
					<select
						id="method"
						class="ui dropdown"
						value={method}
						onchange={e => dispatch('playground/update', { method: e.target.value })}
					>
						<option value="GET">GET</option>
						<option value="POST">POST</option>
						<option value="PUT">PUT</option>
						<option value="DELETE">DELETE</option>
						<option value="HEAD">HEAD</option>
						<option value="PATCH">PATCH</option>
					</select>
				</div>

				<div class="field themed" style="min-width: 250px;">
					<label for="index">Index</label>
					<IndexSelector
						id="index"
						currentlySelected={selectedIndex}
						onSelect={e => dispatch('playground/update', { selectedIndex: e.detail.value })}
						onClear={() => dispatch('playground/update', { selectedIndex: null })}
						allowCustom={true}
						placeholder="Target Index..."
					/>
				</div>

				<div class="field" style="flex: 1;">
					<label for="uri">URI</label>
					<div class="ui action input fluid">
						<input
							id="uri"
							type="text"
							value={path}
							oninput={e => dispatch('playground/update', { path: e.target.value })}
							placeholder={'e.g. {{index}}/_search'}
							onkeydown={e => e.key === 'Enter' && sendRequest()}
						/>
						<button
							class="ui button primary"
							class:loading={isRequestLoading}
							onclick={sendRequest}
						>
							Send
						</button>
					</div>
				</div>

				<!-- svelte-ignore a11y_label_has_associated_control -->
				<label aria-hidden="true">&nbsp;</label>
				<button
					class="ui icon button basic"
					class:inverted
					onclick={() => dispatch('playground/toggleDrawer')}
					aria-label="Toggle Templates"
				>
					<i class="list icon"></i>
				</button>

				<div class="field flex-actions">
					{#if showSaveInput}
						<div class="ui action input">
							<input
								type="text"
								placeholder="Template name..."
								bind:value={templateName}
								onkeydown={e => e.key === 'Enter' && saveTemplate()}
								maxlength={32}
							/>
							<button
								class="ui button icon positive"
								onclick={saveTemplate}
								aria-label="Confirm Save"
							>
								<i class="check icon"></i>
							</button>
							<button
								class="ui button icon"
								onclick={() => {
									showSaveInput = false
									templateName = ''
								}}
								aria-label="Cancel"
							>
								<i class="close icon"></i>
							</button>
						</div>
					{:else}
						<button
							class="ui icon button basic"
							class:inverted
							onclick={() => (showSaveInput = true)}
							aria-label="Save Request"
						>
							<i class="save icon"></i>
						</button>
					{/if}
				</div>
			</div>
		</div>
	</div>

	<div class="ui segment split-view" class:inverted>
		{#if isDrawerOpen}
			<TemplateDrawer />
		{/if}

		<div class="editor-panel">
			<div class="panel-tabs" class:inverted>
				<button
					class="tab"
					class:active={activeTab === 'body'}
					onclick={() => dispatch('playground/update', { activeTab: 'body' })}
				>
					Request Body
				</button>
				<button
					class="tab"
					class:active={activeTab === 'headers'}
					onclick={() => dispatch('playground/update', { activeTab: 'headers' })}
				>
					Headers
				</button>
			</div>

			<div
				class="editor-wrapper"
				style="display: {activeTab === 'body' ? 'block' : 'none'}"
			>
				<JsonEditor
					id="playgroundRequestEditor"
					bind:editor={requestEditor}
					options={requestEditorOptions}
					onError={error => notifyError(error.message)}
				/>
			</div>
			<div
				class="editor-wrapper"
				style="display: {activeTab === 'headers' ? 'block' : 'none'}"
			>
				<KeyValueList bind:items={headerItems} />
			</div>
		</div>

		<div class="editor-panel">
			<div class="panel-tabs" class:inverted>
				<button class="tab response-tab" disabled>Response</button>
			</div>
			<div class="editor-wrapper">
				<JsonEditor
					id="playgroundResponseEditor"
					value={responseBody}
					options={responseEditorOptions}
					onError={error => notifyError(error.message)}
				/>
			</div>
		</div>
	</div>
</div>

<style>
	.playground-container {
		display: flex;
		flex-direction: column;
		height: calc(100vh - 130px);
		border-radius: 4px;
	}
	.top-bar {
		margin-bottom: 0 !important;
		align-items: flex-end;
	}
	.flex-actions {
		display: flex;
		gap: 0.5rem;
		align-items: flex-end;
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
	.panel-tabs {
		display: flex;
		background: #f9f9f9;
		border-bottom: 1px solid #e0e0e0;
	}
	.panel-tabs.inverted {
		background: #222;
		border-bottom-color: #555;
	}
	.tab {
		flex: 1;
		padding: 0.8rem 1rem;
		border: none;
		background: none;
		font-weight: bold;
		font-size: 0.9em;
		color: #555;
		cursor: pointer;
		border-bottom: 2px solid transparent;
		transition: all 0.2s;
		text-align: center;
	}
	:global(.inverted) .tab {
		color: #bbb;
	}
	.tab:hover {
		background: #f0f0f0;
	}
	:global(.inverted) .tab:hover {
		background: #333;
	}
	.tab.active {
		color: #2185d0;
		border-bottom-color: #2185d0;
		background: #fff;
	}
	:global(.inverted) .tab.active {
		background: #1b1c1d;
		color: #4183c4;
	}
	.editor-wrapper {
		flex: 1;
		position: relative;
		overflow: hidden;
	}
	.response-tab {
		cursor: default !important;
		opacity: 1 !important;
	}
	.response-tab:hover {
		background: none !important;
	}
	.themed {
		min-width: 190px;
	}
	/* Ensure jsoneditor takes full height */
	:global(#playgroundRequestEditor),
	:global(#playgroundResponseEditor) {
		height: 100%;
		border: none;
	}
	:global(.jsoneditor) {
		border: none !important;
	}
</style>
