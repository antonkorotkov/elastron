<script>
	import { useStoreon } from '@storeon/svelte'

	import Pagination from '../../components/pagination/Pagination.svelte'

	import isEmpty from 'lodash/isEmpty'
	import get from 'lodash/get'
	import {
		invalidJsonBodyMessage,
		isThemeToggleChecked,
		parseJsonBody,
	} from '../../utils/helpers'

	let { tab, qEditor } = $props()

	const { dispatch, app } = useStoreon('app')

	const update = patch => dispatch('search/update', { id: tab.id, patch })

	let uriPaginationCurrentPage = $derived(() =>
		Math.round(tab.from / tab.size)
	)
	let bodyPaginationOffset = $derived(() => get(tab.requestBody, 'from', 0))
	let bodyPaginationItemsPerPage = $derived(() =>
		get(tab.requestBody, 'size', 10)
	)
	let bodyPaginationCurrentPage = $derived(() => {
		const body = tab.requestBody
		const from = get(body, 'from', 0)
		const size = get(body, 'size', 10)
		return Math.round(from / size)
	})

	const switchView = view => update({ view })

	const onUriPaginationChanged = page => {
		update({ from: tab.size * page })
		dispatch('search/run', tab.id)
	}

	const onBodyPaginationChanged = page => {
		try {
			const requestBody = parseJsonBody(qEditor.getText())
			const size = get(requestBody, 'size', 10)
			requestBody.from = size * page
			qEditor.set(requestBody)
			update({ requestBody })
			dispatch('search/run', tab.id)
		} catch (error) {
			dispatch('notification/add', {
				type: 'error',
				message:
					error instanceof SyntaxError
						? invalidJsonBodyMessage(error)
						: error.message,
			})
		}
	}

	let inverted = $derived(isThemeToggleChecked($app.theme))
</script>

<div class="ui grid">
	<div class="twelve wide column" style="align-content: center">
		<div class="ui circular labels stats">
			Documents found: &nbsp;
			<span class="ui label">{tab.stats.total_results}</span>
			Time: &nbsp;
			<span class="ui label">{tab.stats.time / 1000}s</span>
			Shards: &nbsp;
			<span class="ui blue label" title="Total">
				{tab.stats.total_shards}
			</span>
			<span class="ui green label" title="Successful">
				{tab.stats.successful_shards}
			</span>
			<span class="ui yellow label" title="Skipped">
				{tab.stats.skipped_shards}
			</span>
			<span class="ui red label" title="Failed">
				{tab.stats.failed_shards}
			</span>
			View: &nbsp;
			<span class="ui text">
				<button
					class:inverted
					class="mini ui button"
					class:active={tab.view == 'hits'}
					class:disabled={isEmpty(tab.results)}
					onclick={() => switchView('hits')}
				>
					JSON
				</button>
				<button
					class:inverted
					class="mini ui button"
					class:active={tab.view == 'table'}
					class:disabled={isEmpty(tab.results)}
					onclick={() => switchView('table')}
				>
					Table
				</button>
				<button
					class:inverted
					class="mini ui button"
					class:active={tab.view == 'aggs'}
					class:disabled={isEmpty(tab.aggs)}
					onclick={() => switchView('aggs')}
				>
					Aggs
				</button>
				<button
					class:inverted
					class="mini ui button"
					class:active={tab.view == 'raw'}
					class:disabled={isEmpty(tab.response)}
					onclick={() => switchView('raw')}
				>
					Raw
				</button>
				{#if !isEmpty(tab.profile)}
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
	<div class="four wide column pagination" style="align-content: center">
		{#if tab.type === 'uri'}
			<Pagination
				className="mini"
				disable={tab.loading}
				current_page={uriPaginationCurrentPage()}
				offset={tab.from}
				items_per_page={tab.size}
				total_items={tab.stats.total_results}
				change={onUriPaginationChanged}
			/>
		{/if}

		{#if tab.type === 'body'}
			<Pagination
				className="mini"
				disable={tab.loading}
				current_page={bodyPaginationCurrentPage()}
				offset={bodyPaginationOffset()}
				items_per_page={bodyPaginationItemsPerPage()}
				total_items={tab.stats.total_results}
				change={onBodyPaginationChanged}
			/>
		{/if}
	</div>
</div>

<style>
	.stats {
		display: flex;
		align-items: center;
	}

	.stats .label {
		margin-bottom: 0;
	}

	.pagination {
		text-align: right;
	}
</style>
