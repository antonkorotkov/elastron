<script>
	import { useStoreon } from '@storeon/svelte'
	import JSONEditor from 'jsoneditor'
	import { getContext, onMount, onDestroy } from 'svelte'
	import get from 'lodash/get'
	import isEmpty from 'lodash/isEmpty'

	import API from '../../../api/elasticsearch'
	import { isThemeToggleChecked } from '../../../utils/helpers'

	const { dispatch, connection, index, app } = useStoreon(
		'connection',
		'index',
		'app'
	)

	let { aliases = {}, alias = {}, onCancel = () => {} } = $props();

	let indexRouting = $state(''),
		searchRouting = $state(''),
		isWriteIndex = $state(false),
		canSave = $state(true),
		filterEditor = $state(),
		fEditor,
		isLoading = $state(false)

	const { close } = getContext('modal-window')

	const _onCancel = () => {
		onCancel()
		close()
	}

	const save = async e => {
		e.preventDefault()
		isLoading = true

		try {
			const api = new API($connection)
			const data = {}

			if (fEditor.get()) {
				data.filter = fEditor.get()
			}

			if (isWriteIndex) {
				data.is_write_index = isWriteIndex
			}

			if (!isEmpty(indexRouting)) {
				data.index_routing = indexRouting
			}

			if (!isEmpty(searchRouting)) {
				data.search_routing = searchRouting
			}

			try {
				await api.deleteIndexAlias($index.selected, alias)
			} catch (e) {}
			const result = await api.createIndexAlias($index.selected, alias, data)

			if (result.acknowledged) {
				dispatch('notification/add', {
					type: 'success',
					message: `Alias ${alias} has been updated`,
				})
				dispatch('elasticsearch/index/fetch')
				close()
			} else {
				dispatch('notification/add', {
					type: 'error',
					message: `Something went wrong while updating the alias`,
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

	onMount(() => {
		const { filter, index_routing, search_routing, is_write_index } = get(
			aliases,
			alias,
			{}
		)

		indexRouting = index_routing
		searchRouting = search_routing
		isWriteIndex = is_write_index

		if (filterEditor) {
			fEditor = new JSONEditor(
				filterEditor,
				{
					mode: 'code',
					onChange: () => {
						try {
							fEditor.get()
							canSave = true
						} catch (e) {
							canSave = false
						}
					},
				},
				filter
			)
		}
	})

	onDestroy(() => {
		if (fEditor) {
			fEditor.destroy()
		}
	})

	let inverted = $derived(isThemeToggleChecked($app.theme))
</script>

<div class="ui header">Update New Alias</div>

<div class="content">
	<form
		class="ui form"
		class:inverted
		onsubmit={save}
		id="alias-form"
	>
		<div class="field">
			<label for="index-routing">Index Routing</label>
			<input type="text" id="index-routing" bind:value={indexRouting} />
		</div>
		<div class="field">
			<label for="search-routing">Search Routing</label>
			<input type="text" id="search-routing" bind:value={searchRouting} />
		</div>
		<div class="field">
			<div class="ui checkbox">
				<input
					id="is-write-index"
					type="checkbox"
					bind:checked={isWriteIndex}
				/>
				<label for="is-write-index">Is Write Index</label>
			</div>
		</div>
		<div class="field">
			<label for="filter-editor">Filter</label>
			<div id="filter-editor" bind:this={filterEditor}></div>
		</div>
	</form>
</div>

<div class="actions">
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<div
		class:inverted
		class="ui black deny right button"
		disabled={isLoading}
		onclick={_onCancel}
		role="button"
		tabindex="0"
	>
		Cancel
	</div>
	<button
		type="submit"
		class="ui green right button"
		class:loading={isLoading}
		class:inverted
		form="alias-form"
		disabled={!canSave || isLoading}
	>
		Update
	</button>
</div>
