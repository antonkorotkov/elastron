<script>
	import { useStoreon } from '@storeon/svelte'
	import { getContext } from 'svelte'
	import get from 'lodash/get'

	import ViewAliasFilterDialog from '../../../components/modal/ViewAliasFilterDialog/ViewAliasFilterDialog.svelte'
	import EditAliasDialog from '../../../components/modal/EditAliasDialog/EditAliasDialog.svelte'
	import API from '../../../api/elasticsearch'
	/**
	 * @typedef {Object} Props
	 * @property {string} [cell]
	 * @property {number} [i]
	 * @property {any} columns
	 */

	/** @type {Props} */
	let { cell = '', i = 0, columns } = $props();

	const { open } = getContext('modal-window')
	const { dispatch, connection, index } = useStoreon('connection', 'index')
	let loading = $state(false)

	const onViewFilterClick = () => {
		open(ViewAliasFilterDialog, { filter: cell })
	}

	const onDeleteClick = async () => {
		try {
			if (!confirm('Are you sure you want to delete this alias?')) return
			loading = true

			const api = new API($connection)
			const result = await api.deleteIndexAlias($index.selected, cell)

			if (result.acknowledged) {
				dispatch('notification/add', {
					type: 'success',
					message: `Alias ${cell} of index ${$index.selected} has been deleted`,
				})
				dispatch('elasticsearch/index/fetch')
			} else {
				dispatch('notification/add', {
					type: 'error',
					message: `Something went wrong while deleting the alias`,
				})
			}
		} catch (e) {
			dispatch('notification/add', {
				type: 'error',
				message: e.message,
			})
		}
		loading = false
	}

	const onUpdateClick = () => {
		open(EditAliasDialog, {
			alias: cell,
			aliases: get(
				$index,
				['info', $index.selected, $index.selected, 'aliases'],
				{}
			),
		})
	}
</script>

{#if columns[i] === 'Filter'}
	{#if cell.length}
		{`${cell.slice(0, 50)} ...`}
		<button class="mini ui primary basic button" onclick={onViewFilterClick}>
			View
		</button>
	{/if}
{:else if columns[i] === 'Actions'}
	<button
		class="mini ui primary basic button"
		onclick={onUpdateClick}
		class:disabled={loading}
	>
		Update
	</button>
	<button
		class="mini ui red basic button"
		onclick={onDeleteClick}
		class:disabled={loading}
	>
		Delete
	</button>
{:else}{cell}{/if}
