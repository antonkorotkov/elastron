<script>
	import { useStoreon } from '@storeon/svelte'

	import Pagination from '../../components/pagination/Pagination.svelte'

	import isEmpty from 'lodash/isEmpty'
	import get from 'lodash/get'
	import { isThemeToggleChecked } from '../../utils/helpers'

	let { qEditor } = $props();

	const { dispatch, search, app } = useStoreon('search', 'app')

	let uriPaginationCurrentPage = $derived(() => Math.round($search.from / $search.size))
	let bodyPaginationOffset = $derived(() => get($search.requestBody, 'from', 0))
	let bodyPaginationItemsPerPage = $derived(() => get($search.requestBody, 'size', 10))
	let bodyPaginationCurrentPage = $derived(() => {
		const body = $search.requestBody
		const from = get(body, 'from', 0)
		const size = get(body, 'size', 10)
		return Math.round(from / size)
	})

	const switchView = view => {
		dispatch('search/update', { view })
	}

	const onUriPaginationChanged = page => {
		dispatch('search/update', { from: $search.size * page })
		dispatch('search/run')
	}

	const onBodyPaginationChanged = page => {
		try {
			const requestBody = qEditor.get()
			const size = get(requestBody, 'size', 10)
			requestBody.from = size * page
			qEditor.set(requestBody)
			dispatch('search/update', { requestBody })
			dispatch('search/run')
		} catch (error) {
			dispatch('notification/add', {
				type: 'error',
				message: error.message,
			})
		}
	}

	let inverted = $derived(isThemeToggleChecked($app.theme))
</script>

<div class="ui grid">
	<div class="twelve wide column">
		<div class="ui circular labels stats">
			Documents found: &nbsp;
			<span class="ui label">{$search.stats.total_results}</span>
			Time: &nbsp;
			<span class="ui label">{$search.stats.time / 1000}s</span>
			Shards: &nbsp;
			<span class="ui blue label" title="Total">
				{$search.stats.total_shards}
			</span>
			<span class="ui green label" title="Successful">
				{$search.stats.successful_shards}
			</span>
			<span class="ui yellow label" title="Skipped">
				{$search.stats.skipped_shards}
			</span>
			<span class="ui red label" title="Failed">
				{$search.stats.failed_shards}
			</span>
			View: &nbsp;
			<span class="ui text">
				<button
					class:inverted
					class="mini ui button"
					class:active={$search.view == 'hits'}
					class:disabled={isEmpty($search.results)}
					onclick={() => switchView('hits')}
				>
					Hits
				</button>
				<button
					class:inverted
					class="mini ui button"
					class:active={$search.view == 'aggs'}
					class:disabled={isEmpty($search.aggs)}
					onclick={() => switchView('aggs')}
				>
					Aggs
				</button>
				<button
					class:inverted
					class="mini ui button"
					class:active={$search.view == 'raw'}
					class:disabled={isEmpty($search.response)}
					onclick={() => switchView('raw')}
				>
					Raw
				</button>
				{#if !isEmpty($search.profile)}
					<button
						class:inverted
						class="mini ui button blue"
						onclick={() => switchView('profile')}
					>
						Profile
					</button>
				{/if}
			</span>
		</div>
	</div>
	<div class="four wide column pagination">
		{#if $search.type === 'uri'}
			<Pagination
				className="mini"
				disable={$search.loading}
				current_page={uriPaginationCurrentPage()}
				offset={$search.from}
				items_per_page={$search.size}
				total_items={$search.stats.total_results}
				change={onUriPaginationChanged}
			/>
		{/if}

		{#if $search.type === 'body'}
			<Pagination
				className="mini"
				disable={$search.loading}
				current_page={bodyPaginationCurrentPage()}
				offset={bodyPaginationOffset()}
				items_per_page={bodyPaginationItemsPerPage()}
				total_items={$search.stats.total_results}
				change={onBodyPaginationChanged}
			/>
		{/if}
	</div>
</div>

<style>
	.stats {
		margin-bottom: 7px;
	}

	.pagination {
		text-align: right;
	}
</style>
