<script>
	import { useStoreon } from '@storeon/svelte'
	import { onMount, getContext } from 'svelte'
	import orderBy from 'lodash/orderBy'
	import isEmpty from 'lodash/isEmpty'
	import { isThemeToggleChecked } from '../../../utils/helpers'

	import Table from '../../../components/tables/Table.svelte'
	import Cell from './Cell.svelte'
	import {
		humanStoreSizeToPseudoBytes,
		filterArrayBy,
	} from '../../../utils/helpers.js'
	import CreateIndexDialog from '../../../components/modal/CreateIndexDialog/CreateIndexDialog.svelte'
	import IconButton from '../../../components/buttons/IconButton.svelte'

	const { dispatch, app, indices } = useStoreon('app', 'indices')
	const { open } = getContext('modal-window')

	let search = $state($indices.search)

	const onTableSort = (column, index, direction) => {
		const sort = o => {
			switch (column) {
				case 'docs.count':
				case 'docs.deleted':
				case 'pri':
				case 'rep':
					return Number(o[index])
				case 'pri.store.size':
				case 'store.size':
					return humanStoreSizeToPseudoBytes(o[index])
				default:
					return o[index]
			}
		}

		const sorted = orderBy($indices.data, [sort], [direction])
		dispatch('elasticsearch/indices/update', { data: sorted })
	}

	onMount(async () => {
		if (!$indices.data.length) dispatch('elasticsearch/indices/fetch')
	})

	const showCreateIndexDialog = () => {
		open(CreateIndexDialog)
	}

	let filterRows = $derived(data => {
		if (isEmpty(search)) return data

		return filterArrayBy(data, search)
	})

	let inverted = $derived(isThemeToggleChecked($app.theme))
</script>

<div class="ui segments">
	<div class="ui segment" class:inverted>
		<div class="ui grid">
			<div class="eight wide column middle aligned">
				<h4>
					Indices
					<span class="add-index">
						<IconButton
							className="plus circle"
							title="Create new index"
							onClick={showCreateIndexDialog}
						/>
					</span>
				</h4>
			</div>
			<div class="eight wide column right aligned">
				<div class="ui mini form search">
					<div class="inline fields">
						<div class="field">
							<input
								bind:value={search}
								onchange={e =>
									dispatch('elasticsearch/indices/update', {
										search,
									})}
								type="text"
								placeholder="Search"
							/>
						</div>
					</div>
				</div>

				<IconButton
					className="sync alternate refresh"
					loading={$indices.loading}
					onClick={() => dispatch('elasticsearch/indices/fetch')}
				/>
			</div>
		</div>
	</div>
	{#if $indices.columns.length}
		<Table
			columns={$indices.columns}
			rows={filterRows($indices.data)}
			sorter={onTableSort}
			emptyMessage="No indices found"
			selectable
			sortable
			{Cell}
		/>
	{:else}
		<div class="ui segment" class:inverted>
			<p>
				No
				<code>indices</code>
				data yet
			</p>
		</div>
	{/if}
</div>

<style>
	.add-index {
		margin-left: 0.5rem;
	}

	.search {
		display: inline-block;
	}

	.search .fields {
		margin: 0;
	}
</style>
