<script>
	import { useStoreon } from '@storeon/svelte'
	import get from 'lodash/get'

	import API from '../../../api/elasticsearch'
	import JsonEditor from '../../../components/JsonEditor.svelte'

	const { dispatch, index, connection } = useStoreon('index', 'connection')

	let mpEditor = $state(null)
	let isLoading = $state(false)
	let canUpdate = $state(true)

	let value = $derived(
		get($index.info, [$index.selected, $index.selected, 'mappings'], null)
	)


	const editorOptions = {
		mode: 'tree',
		modes: ['code', 'tree'],
		maxVisibleChilds: 0,
		onModeChange: mode => {
			if (mode === 'code') mpEditor?.aceEditor.setOptions({ maxLines: 64 })
		},
		onChange: () => {
			try {
				mpEditor?.get()
				canUpdate = true
			} catch (_) {
				canUpdate = false
			}
		},
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
			onclick={e => onUpdateMappingClick($index.selected)}
			class:loading={isLoading}
			disabled={isLoading || !canUpdate}
		>
			Update
		</button>
	</div>
	<div class="ui right floated tiny buttons"></div>
</div>

<div class="ui vertical segment">
	<JsonEditor
		id="mapping-preview"
		{value}
		options={editorOptions}
		bind:editor={mpEditor}
	/>
</div>
