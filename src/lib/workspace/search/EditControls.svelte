<script>
	import { useStoreon } from '@storeon/svelte'

	let { tab, canEditDoc, rEditor } = $props()

	const { dispatch } = useStoreon()

	const saveEditDoc = method => {
		if (method === 'update')
			return () => {
				try {
					if (
						confirm(
							'Only listed fields will be updated in the document. Continue?'
						)
					)
						dispatch('search/documents/update', {
							id: tab.id,
							data: rEditor.get(),
						})
				} catch ({ message }) {
					dispatch('notification/add', {
						type: 'error',
						message,
					})
				}
			}

		if (method === 'reindex')
			return () => {
				try {
					if (
						confirm(
							'The entire document will be reindexed using listed fields. Continue?'
						)
					)
						dispatch('search/documents/reindex', {
							id: tab.id,
							data: rEditor.get(),
						})
				} catch ({ message }) {
					dispatch('notification/add', {
						type: 'error',
						message,
					})
				}
			}
	}
</script>

<div class="ui grid">
	<div class="sixteen wide column">
		<div class="edit-doc">
			Editing: &nbsp;
			<span class="ui label">
				{tab.editDoc._type ?? 'doc'}:{tab.editDoc._id}
			</span>
			of index
			<span class="ui label">{tab.editDoc._index}</span>
			&nbsp|&nbsp;
			<span class="ui text">
				<button
					class="mini ui button green"
					disabled={!canEditDoc || tab.loading}
					onclick={saveEditDoc('update')}
				>
					Update
				</button>
				<button
					class="mini ui button blue"
					disabled={!canEditDoc || tab.loading}
					onclick={saveEditDoc('reindex')}
				>
					Reindex
				</button>
				<button
					class="mini ui button red"
					disabled={tab.loading}
					onclick={() =>
						dispatch('search/update', { id: tab.id, patch: { view: 'hits' } })}
				>
					Cancel
				</button>
			</span>
		</div>
	</div>
</div>
