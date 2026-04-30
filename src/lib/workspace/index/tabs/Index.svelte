<script>
	import { getContext } from 'svelte'
	import { useStoreon } from '@storeon/svelte'
	import { goto } from '$app/navigation'
	import { resolve } from '$app/paths'
	import get from 'lodash/get'

	import API from '../../../api/elasticsearch'
	import JsonEditor from '../../../components/JsonEditor.svelte'
	import CloneIndexDialog from '../../../components/modal/CloneIndexDialog/CloneIndexDialog.svelte'

	const { open } = getContext('modal-window')
	const { dispatch, index, connection } = useStoreon(
		'index',
		'connection',
		'indices'
	)

	let value = $derived(
		get($index.info, [$index.selected, $index.selected], null)
	)


	const editorOptions = {
		mode: 'tree',
		onEditable: () => false,
		onCreateMenu: () => [],
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

		goto(resolve('/'))
	}

	const onCloseIndexClick = async indexName => {
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
	}

	const onOpenIndexClick = async indexName => {
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
	}

	const onWipeIndexClick = async indexName => {
		if (
			!confirm(
				'Are you sure you want to wipe the index? It means you will loose all index data without an ability to restore.'
			)
		)
			return

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
	}

	const showCloneIndexDialog = () => open(CloneIndexDialog)
</script>

<div>
	<div class="ui tiny buttons">
		<button
			class="ui tiny blue basic button"
			onclick={e => onOpenIndexClick($index.selected)}
			class:loading={$index.loading}
			disabled={$index.loading}
		>
			Open
		</button>
		<button
			class="ui tiny blue basic button"
			onclick={e => onCloseIndexClick($index.selected)}
			class:loading={$index.loading}
			disabled={$index.loading}
		>
			Close
		</button>

		<button
			class="ui tiny green basic button"
			onclick={showCloneIndexDialog}
			class:loading={$index.loading}
			disabled={$index.loading}
		>
			Clone
		</button>
	</div>
	<div class="ui right floated tiny buttons">
		<button
			class="ui orange basic button"
			onclick={e => onWipeIndexClick($index.selected)}
			class:loading={$index.loading}
			disabled={$index.loading}
		>
			Wipe
		</button>
		<button
			class="ui red basic button"
			onclick={e => onDeleteIndexClick($index.selected)}
			class:loading={$index.loading}
			disabled={$index.loading}
		>
			Delete
		</button>
	</div>
</div>

<div class="ui vertical segment">
	<JsonEditor id="index-preview" {value} options={editorOptions} />
</div>
