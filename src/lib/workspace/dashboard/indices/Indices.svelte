<script>
	import { onMount, getContext } from 'svelte'
	import { useStoreon } from '@storeon/svelte'
	import orderBy from 'lodash/orderBy.js'
	import isEmpty from 'lodash/isEmpty.js'
	import debounce from 'lodash/debounce.js'

	import {
		indicesSortPredicate,
		isThemeToggleChecked,
		filterArrayBy,
	} from '../../../utils/helpers'
	import VirtualTable from '../../../components/tables/VirtualTable.svelte'
	import Cell from './Cell.svelte'
	import CreateIndexDialog from '../../../components/modal/CreateIndexDialog/CreateIndexDialog.svelte'
	import ButtonTinyBasic from '../../../components/buttons/ButtonTinyBasic.svelte'
	import AutoRefreshButtonGroup from '../../../components/buttons/AutoRefreshButtonGroup.svelte'

	const { dispatch, app, indices } = useStoreon('app', 'indices')
	const { open } = getContext('modal-window')

	let inverted = $derived(isThemeToggleChecked($app.theme))
	let indicesList = $derived($indices.data)
	let sorting = $derived($indices.sorting)
	let search = $derived($indices.search)
	let data = $derived.by(() => {
		const [direction, column, index] = sorting
		let list = indicesList

		if (direction && column && index !== undefined)
			list = orderBy(list, [indicesSortPredicate(column, index)], [direction])

		if (!isEmpty(search)) list = filterArrayBy(list, search)

		return list
	})

	const showCreateIndexDialog = () => {
		open(CreateIndexDialog)
	}

	const onSearchChange = debounce(e => {
		dispatch('elasticsearch/indices/update', { search: e.target.value })
	}, 300)

	const onRefresh = () => {
		dispatch('elasticsearch/indices/fetch')
	}

	const onSort = (column, index, direction) => {
		dispatch('elasticsearch/indices/update', {
			sorting: [direction, column, index],
		})
	}

	const onAutoRefreshChange = () => {
		dispatch('elasticsearch/indices/update', {
			autoRefresh: !$indices.autoRefresh,
		})
	}

	const onIntervalChange = e => {
		dispatch('elasticsearch/indices/update', {
			interval: Number(e.target.value),
		})
	}
</script>

<div class="ui segments">
	<div class="ui segment" class:inverted>
		<div class="ui grid">
			<div class="eight wide column middle aligned">
				<div class="ui tiny buttons">
					<AutoRefreshButtonGroup
						loading={$indices.loading}
						autoRefresh={$indices.autoRefresh}
						interval={$indices.interval}
						{inverted}
						{onRefresh}
						{onAutoRefreshChange}
						{onIntervalChange}
					/>
				</div>
				<ButtonTinyBasic
					label="Create"
					color="green"
					loading={$indices.loading}
					onClick={showCreateIndexDialog}
				/>
			</div>
			<div class="eight wide column right aligned">
				<div class="ui horizontal list">
					<div class="item">
						<span class="ui grey text">
							{data.length}
							{data.length === 1 ? 'item' : 'items'}
						</span>
					</div>
					<div class="item">
						<div class="ui search">
							<div class="ui icon input" class:inverted>
								<input
									class="prompt"
									onkeyup={onSearchChange}
									type="text"
									placeholder="Search..."
									defaultValue={search}
								/>
								<i class="search icon"></i>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
	{#if $indices.columns.length}
		<VirtualTable
			columns={$indices.columns}
			rows={data}
			{onSort}
			{sorting}
			emptyMessage="No indices found"
			selectable
			footerColumns
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
