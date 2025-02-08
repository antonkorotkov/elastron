<script>
	import { preventDefault } from 'svelte/legacy';

	import { useStoreon } from '@storeon/svelte'
	import { onMount, getContext } from 'svelte'
	import JSONEditor from 'jsoneditor'

	import API from '../../../api/elasticsearch'
	import {
		isThemeToggleChecked,
		validateIndexName,
	} from '../../../utils/helpers.js'

	const { close } = getContext('modal-window')
	const { dispatch, connection, indices, app } = useStoreon(
		'connection',
		'indices',
		'app'
	)

	let { onCancel = () => {} } = $props();

	let indexName = $state(''),
		isLoading = $state(false),
		canCreate = $state(true),
		settingsEditor = $state(),
		sEditor

	let _indices =
		$indices.data.map(
			item =>
				item[
					$indices.columns.reduce(
						(i, item, index) => (item === 'index' ? index : i),
						0
					)
				]
		) || []

	onMount(() => {
		document.getElementById('index-name').focus()

		if (settingsEditor) {
			sEditor = new JSONEditor(
				settingsEditor,
				{
					mode: 'code',
					onChange: () => {
						try {
							sEditor.get()
							canCreate = true
						} catch (e) {
							canCreate = false
						}
					},
				},
				{}
			)
			sEditor.aceEditor.setOptions({ maxLines: 32 })
		}
	})

	const _onCancel = () => {
		onCancel()
		close()
	}

	const create = async () => {
		isLoading = true

		try {
			const api = new API($connection)
			const result = await api.createIndex(indexName, sEditor.get())

			if (result.acknowledged) {
				dispatch('notification/add', {
					type: 'success',
					message: `Index ${indexName} has been created`,
				})
				dispatch('elasticsearch/indices/fetch')
				dispatch('elasticsearch/shards/fetch')
				dispatch('elasticsearch/allocation/fetch')
				close()
			} else {
				dispatch('notification/add', {
					type: 'error',
					message: `Something went wrong while creating the index`,
				})
			}
		} catch (e) {
			dispatch('notification/add', {
				type: 'error',
				message: e.message,
			})
		}

		isLoading = false
	}

	const isIndexNameAllowed = name =>
		validateIndexName(name) && !_indices.includes(name)

	let inverted = $derived(isThemeToggleChecked($app.theme))
</script>

<div class="ui header">Create New Index</div>

<div class="content">
	<form
		class="ui form"
		class:inverted
		onsubmit={preventDefault(create)}
		id="create-index-form"
	>
		<div class="field">
			<label for="index-name">Index Name</label>
			<input type="text" id="index-name" bind:value={indexName} />
		</div>
		<div class="field">
			<label for="settings-editor">Index Configuration</label>
			<div id="settings-editor" bind:this={settingsEditor}></div>
		</div>
	</form>
</div>

<div class="actions">
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<div
		class="ui black deny button right"
		class:inverted
		onclick={_onCancel}
		role="button"
		tabindex="0"
	>
		Cancel
	</div>
	<button
		class:inverted
		disabled={!isIndexNameAllowed(indexName) || isLoading || !canCreate}
		type="submit"
		class="ui green right button"
		class:loading={isLoading}
		form="create-index-form"
	>
		Create
	</button>
</div>
