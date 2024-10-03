<script>
	export let aliases = {}

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

	export let onCancel = () => {}
	export let onOkay = () => {}

	let aliasName = '',
		indexRouting = '',
		searchRouting = '',
		isWriteIndex = false,
		canSave = true,
		filterEditor,
		fEditor,
		isLoading = false

	const { close } = getContext('modal-window')

	const _onCancel = () => {
		onCancel()
		close()
	}

	const _onOkay = () => {
		onOkay(value)
		close()
	}

	const save = async () => {
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

			const result = await api.createIndexAlias(
				$index.selected,
				aliasName,
				data
			)

			if (result.acknowledged) {
				dispatch('notification/add', {
					type: 'success',
					message: `Alias ${aliasName} has been created`,
				})
				dispatch('elasticsearch/index/fetch')
				close()
			} else {
				dispatch('notification/add', {
					type: 'error',
					message: `Something went wrong while creating the alias`,
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

	const isAliasNameAllowed = name => {
		if (!name.length) return false
		return !get(aliases, name, false)
	}

	onMount(() => {
		if (filterEditor) {
			fEditor = new JSONEditor(filterEditor, {
				mode: 'code',
				onChange: () => {
					try {
						fEditor.get()
						canSave = true
					} catch (e) {
						canSave = false
					}
				},
			})
		}
	})

	onDestroy(() => {
		if (fEditor) {
			fEditor.destroy()
		}
	})

	$: inverted = isThemeToggleChecked($app.theme)
</script>

<div class="ui header">Create New Alias</div>

<div class="content">
	<form
		class="ui form"
		class:inverted
		on:submit|preventDefault={save}
		id="alias-form"
	>
		<div class="field">
			<label for="alias-name">Alias Name</label>
			<input type="text" id="alias-name" bind:value={aliasName} />
		</div>
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
			<div id="filter-editor" bind:this={filterEditor} />
		</div>
	</form>
</div>

<div class="actions">
	<!-- svelte-ignore a11y-click-events-have-key-events -->
	<div
		class="ui black deny right button"
		disabled={isLoading}
		class:inverted
		on:click={_onCancel}
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
		disabled={!isAliasNameAllowed(aliasName) || !canSave || isLoading}
	>
		Create
	</button>
</div>
