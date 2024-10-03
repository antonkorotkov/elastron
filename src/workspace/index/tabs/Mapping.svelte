<script>
	import JSONEditor from 'jsoneditor'
	import { onMount, onDestroy } from 'svelte'
	import { useStoreon } from '@storeon/svelte'
	import get from 'lodash/get'

	import API from '../../../api/elasticsearch'

	const { dispatch, index, connection } = useStoreon('index', 'connection')

	let mappingPreviewEditor, mpEditor
	let isLoading = false,
		canUpdate = true

	const updateEditorContent = () => {
		const mappings = get(
			$index.info,
			[$index.selected, $index.selected, 'mappings'],
			false
		)

		if (mappings) mpEditor.update(mappings)
	}

	onMount(() => {
		if (mappingPreviewEditor) {
			mpEditor = new JSONEditor(mappingPreviewEditor, {
				mode: 'tree',
				modes: ['code', 'tree'],
				maxVisibleChilds: 0,
				onModeChange,
				onChange: () => {
					try {
						mpEditor.get()
						canUpdate = true
					} catch (e) {
						canUpdate = false
					}
				},
			})

			updateEditorContent()
		}

		if (!$index.info[$index.selected]) dispatch('elasticsearch/index/fetch')
	})

	onDestroy(() => {
		if (mpEditor) {
			mpEditor.destroy()
		}
	})

	const onModeChange = mode => {
		if (mode === 'code') mpEditor.aceEditor.setOptions({ maxLines: 64 })
	}

	const onUpdateMappingClick = async indexName => {
		isLoading = true

		try {
			const api = new API($connection)
			const result = await api.updateIndexMapping(indexName, mpEditor.get())

			if (Array.isArray(result)) {
				let successed = 0
				let failed = 0
				for (let res of result) {
					if (res.acknowledged) {
						successed++
					} else {
						failed++
					}
				}

				if (successed > 0) {
					dispatch('notification/add', {
						type: 'success',
						message: `Mapping of index ${indexName} has been updated for ${successed} type(s)`,
					})
				}

				if (failed > 0) {
					dispatch('notification/add', {
						type: 'error',
						message: `Mapping update failed for ${failed} type(s) of index ${indexName}`,
					})
				}
				dispatch('elasticsearch/index/fetch')
				isLoading = false
				return
			} else if (result.acknowledged) {
				dispatch('notification/add', {
					type: 'success',
					message: `Mapping of index ${indexName} has been updated`,
				})
				dispatch('elasticsearch/index/fetch')
				isLoading = false
				return
			}

			dispatch('notification/add', {
				type: 'error',
				message: `Something went wrong while updating the mapping`,
			})
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
			class="ui green basic button"
			on:click={e => onUpdateMappingClick($index.selected)}
			class:loading={isLoading}
			disabled={isLoading || !canUpdate}
		>
			Update
		</button>
	</div>
	<div class="ui right floated tiny buttons" />
</div>

<div class="ui vertical segment">
	<div id="mapping-preview" bind:this={mappingPreviewEditor} />
</div>
