<script>
	import { useStoreon } from '@storeon/svelte'
	import get from 'lodash/get'
	import pick from 'lodash/pick'

	import API from '../../../api/elasticsearch'
	import JsonEditor from '../../../components/JsonEditor.svelte'

	const { dispatch, index, connection } = useStoreon('index', 'connection')

	const dynamicSettings = [
		'index.number_of_replicas',
		'index.auto_expand_replicas',
		'index.search.idle.after',
		'index.refresh_interval',
		'index.max_result_window',
		'index.max_inner_result_window',
		'index.max_rescore_window',
		'index.max_docvalue_fields_search',
		'index.max_script_fields',
		'index.max_ngram_diff',
		'index.max_shingle_diff',
		'index.blocks.read_only',
		'index.blocks.read_only_allow_delete',
		'index.blocks.read',
		'index.blocks.write',
		'index.blocks.metadata',
		'index.max_refresh_listeners',
		'index.analyze.max_token_count',
		'index.highlight.max_analyzed_offset',
		'index.max_terms_count',
		'index.max_regex_length',
		'index.routing.allocation.enable',
		'index.routing.rebalance.enable',
		'index.gc_deletes',
		'index.default_pipeline',
		'index.final_pipeline',
	]

	let spEditor = $state(null)
	let isLoading = $state(false)
	let canUpdate = $state(true)

	let value = $derived(
		get($index.info, [$index.selected, $index.selected, 'settings'], null)
	)


	const editorOptions = {
		mode: 'tree',
		modes: ['code', 'tree'],
		maxVisibleChilds: 0,
		onModeChange: mode => {
			if (mode === 'code') spEditor?.aceEditor.setOptions({ maxLines: 64 })
		},
		onChange: () => {
			try {
				spEditor?.get()
				canUpdate = true
			} catch (_) {
				canUpdate = false
			}
		},
	}

	const refreshDashboard = () => {
		dispatch('elasticsearch/indices/fetch')
		dispatch('elasticsearch/shards/fetch')
		dispatch('elasticsearch/allocation/fetch')
	}

	const onUpdateSettingsClick = async indexName => {
		isLoading = true

		try {
			const updatableSettings = pick(spEditor.get(), dynamicSettings)

			const api = new API($connection)
			const result = await api.updateIndexSettings(indexName, updatableSettings)

			if (result.acknowledged) {
				dispatch('notification/add', {
					type: 'success',
					message: `Settings of index ${indexName} have been updated`,
				})
				dispatch('elasticsearch/index/fetch')
				refreshDashboard()
				isLoading = false
				return
			}

			dispatch('notification/add', {
				type: 'error',
				message: `Something went wrong while updating the settings`,
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
			onclick={e => onUpdateSettingsClick($index.selected)}
			class:loading={isLoading}
			disabled={isLoading || !canUpdate}
		>
			Update
		</button>
	</div>
	<a
		aria-label="List of settings that can be updated"
		class="help-link"
		title="List of settings that can be updated"
		href="https://www.elastic.co/guide/en/elasticsearch/reference/current/index-modules.html#dynamic-index-settings"
		target="_blank"
	>
		<i class="info circle icon"></i>
	</a>
</div>

<div class="ui vertical segment">
	<JsonEditor
		id="settings-preview"
		{value}
		options={editorOptions}
		bind:editor={spEditor}
		onError={({ message }) =>
			dispatch('notification/add', { type: 'error', message })}
	/>
</div>

<style>
	.help-link {
		margin-left: 0.5rem;
	}
</style>
