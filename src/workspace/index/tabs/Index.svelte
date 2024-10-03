<script>
	import JSONEditor from 'jsoneditor'
	import { onMount, onDestroy, afterUpdate, getContext } from 'svelte'
	import { useStoreon } from '@storeon/svelte'
	import { routerNavigate } from '@storeon/router'
	import get from 'lodash/get'

	import API from '../../../api/elasticsearch'
	import CloneIndexDialog from '../../../components/modal/CloneIndexDialog/CloneIndexDialog.svelte'

	const { open } = getContext('modal-window')

	const { dispatch, index, connection, indices } = useStoreon(
		'index',
		'connection',
		'indices'
	)

	let indexPreviewEditor, ipEditor
	let isLoading = false

	onMount(() => {
		if (indexPreviewEditor) {
			ipEditor = new JSONEditor(indexPreviewEditor, {
				mode: 'tree',
				onEditable: () => false,
				onCreateMenu: () => [],
			})
		}

		if (!$index.info[$index.selected]) dispatch('elasticsearch/index/fetch')
	})

	afterUpdate(() => {
		if (!$index.info[$index.selected]) dispatch('elasticsearch/index/fetch')

		const info = get($index.info, [$index.selected, $index.selected], false)

		if (info) ipEditor.update(info)
	})

	onDestroy(() => {
		if (ipEditor) {
			ipEditor.destroy()
		}
	})

	const showCloneIndexDialog = () => {
		open(CloneIndexDialog)
	}

	const refreshDashboard = () => {
		dispatch('elasticsearch/indices/fetch')
		dispatch('elasticsearch/shards/fetch')
		dispatch('elasticsearch/allocation/fetch')
	}

	const onDeleteIndexClick = async indexName => {
		if (
			!confirm(
				'Are you sure you want to delete the index? You will loose all index data without an ability to restore.'
			)
		)
			return

		isLoading = true

		try {
			const api = new API($connection)
			const result = await api.deleteIndex(indexName)

			if (result.acknowledged) {
				dispatch('notification/add', {
					type: 'success',
					message: `Index ${indexName} has been deleted`,
				})
				refreshDashboard()
			} else {
				dispatch('notification/add', {
					type: 'error',
					message: `Something went wrong while deleting the index`,
				})
			}
		} catch (e) {
			dispatch('notification/add', {
				type: 'error',
				message: e.message,
			})
		}

		dispatch(routerNavigate, '/')
		isLoading = false
	}

	const onCloseIndexClick = async indexName => {
		isLoading = true

		try {
			const api = new API($connection)
			const result = await api.closeIndex(indexName)

			if (result.acknowledged) {
				dispatch('notification/add', {
					type: 'success',
					message: `Index ${indexName} has been closed`,
				})
				refreshDashboard()
				dispatch('elasticsearch/index/fetch')
			} else {
				dispatch('notification/add', {
					type: 'error',
					message: `Something went wrong while closing the index`,
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

	const onOpenIndexClick = async indexName => {
		isLoading = true

		try {
			const api = new API($connection)
			const result = await api.openIndex(indexName)

			if (result.acknowledged) {
				dispatch('notification/add', {
					type: 'success',
					message: `Index ${indexName} has been opened`,
				})
				refreshDashboard()
				dispatch('elasticsearch/index/fetch')
			} else {
				dispatch('notification/add', {
					type: 'error',
					message: `Something went wrong while opening the index`,
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

	const onFreezeIndexClick = async indexName => {
		isLoading = true

		try {
			const api = new API($connection)
			const result = await api.freezeIndex(indexName)

			if (result.acknowledged) {
				dispatch('notification/add', {
					type: 'success',
					message: `Index ${indexName} has been frozen`,
				})
				refreshDashboard()
				dispatch('elasticsearch/index/fetch')
			} else {
				dispatch('notification/add', {
					type: 'error',
					message: `Something went wrong while freezing the index`,
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

	const onUnfreezeIndexClick = async indexName => {
		isLoading = true

		try {
			const api = new API($connection)
			const result = await api.unfreezeIndex(indexName)

			if (result.acknowledged) {
				dispatch('notification/add', {
					type: 'success',
					message: `Index ${indexName} has been unfrozen`,
				})
				refreshDashboard()
				dispatch('elasticsearch/index/fetch')
			} else {
				dispatch('notification/add', {
					type: 'error',
					message: `Something went wrong while unfreezing the index`,
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

	const onWipeIndexClick = async indexName => {
		if (
			!confirm(
				'Are you sure you want to wipe the index? It means you will loose all index data without an ability to restore.'
			)
		)
			return

		isLoading = true

		try {
			const api = new API($connection)
			const result = await api.wipeIndex(indexName)

			if (get(result, 'deleted', false) !== false) {
				dispatch('notification/add', {
					type: 'success',
					message: `Index ${indexName} has been wiped. Documents deleted: ${result.deleted}.`,
				})
			} else {
				dispatch('notification/add', {
					type: 'error',
					message: `Something went wrong while wiping the index`,
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
</script>

<div>
	<div class="ui tiny buttons">
		<button
			class="ui tiny blue basic button"
			on:click={e => onOpenIndexClick($index.selected)}
			class:loading={isLoading}
			disabled={isLoading}
		>
			Open
		</button>
		<button
			class="ui tiny blue basic button"
			on:click={e => onCloseIndexClick($index.selected)}
			class:loading={isLoading}
			disabled={isLoading}
		>
			Close
		</button>

		<button
			class="ui tiny teal basic button"
			on:click={e => onFreezeIndexClick($index.selected)}
			class:loading={isLoading}
			disabled={isLoading}
		>
			Freeze
		</button>
		<button
			class="ui tiny teal basic button"
			on:click={e => onUnfreezeIndexClick($index.selected)}
			class:loading={isLoading}
			disabled={isLoading}
		>
			Unfreeze
		</button>

		<button
			class="ui tiny green basic button"
			on:click={showCloneIndexDialog}
			class:loading={isLoading}
			disabled={isLoading}
		>
			Clone
		</button>
	</div>
	<div class="ui right floated tiny buttons">
		<button
			class="ui orange basic button"
			on:click={e => onWipeIndexClick($index.selected)}
			class:loading={isLoading}
			disabled={isLoading}
		>
			Wipe
		</button>
		<button
			class="ui red basic button"
			on:click={e => onDeleteIndexClick($index.selected)}
			class:loading={isLoading}
			disabled={isLoading}
		>
			Delete
		</button>
	</div>
</div>

<div class="ui vertical segment">
	<div id="index-preview" bind:this={indexPreviewEditor} />
</div>
