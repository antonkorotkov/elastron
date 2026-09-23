<script>
	import { onMount, getContext } from 'svelte'
	import { useStoreon } from '@storeon/svelte'
	import orderBy from 'lodash/orderBy.js'
	import debounce from 'lodash/debounce.js'

	import { isThemeToggleChecked, filterArrayBy } from '$lib/utils/helpers'
	import SecurityList from '../SecurityList.svelte'
	import ApiKeyCell from './ApiKeyCell.svelte'
	import ButtonTinyBasic from '$lib/components/buttons/ButtonTinyBasic.svelte'

	const { dispatch, app, securityApiKeys } = useStoreon('app', 'securityApiKeys')
	const { open } = getContext('modal-window')

	let inverted = $derived(isThemeToggleChecked($app.theme))

	const COLUMNS = ['name', 'owner', 'created', 'expires', 'status']

	const asDate = ms => (ms ? new Date(ms).toLocaleString() : '—')

	const statusOf = key => {
		if (key.invalidated) return 'invalidated'
		if (key.expiration && key.expiration < Date.now()) return 'expired'
		return 'active'
	}

	let entries = $derived($securityApiKeys.entries)
	let search = $derived($securityApiKeys.search)
	let sorting = $derived($securityApiKeys.sorting)
	let showInvalidated = $derived($securityApiKeys.showInvalidated)

	// An invalidated key cannot be removed: Elasticsearch has no delete for API
	// keys, and its own retention period, seven days by default, is what clears
	// them. They are hidden by default so the list stays actionable.
	let visible = $derived(showInvalidated ? entries : entries.filter(k => !k.invalidated))
	let hiddenCount = $derived(entries.length - visible.length)

	let data = $derived.by(() => {
		let list = visible.map(k => [
			k.name || '—',
			k.username || '—',
			asDate(k.creation),
			k.expiration ? asDate(k.expiration) : 'never',
			statusOf(k),
		])

		const [direction, , index] = sorting
		if (direction && index !== undefined) {
			list = orderBy(list, [row => String(row[index]).toLowerCase()], [direction])
		}
		if (search) list = filterArrayBy(list, search)
		return list
	})

	const onRefresh = () => dispatch('security/api-keys/fetch')

	const onSearchChange = debounce(
		e => dispatch('security/api-keys/update', { search: e.target.value }),
		300
	)

	const onSort = (column, index, direction) =>
		dispatch('security/api-keys/update', { sorting: [direction, column, index] })

	const onShowInvalidatedChange = e =>
		dispatch('security/api-keys/update', { showInvalidated: e.target.checked })

	const showCreateKeyDialog = async () => {
		const Dialog = (await import('./CreateApiKeyDialog.svelte')).default
		open(Dialog, {}, { closeOnOuterClick: false })
	}

	onMount(onRefresh)
</script>

<div class="ui segments">
	<div class="ui segment" class:inverted>
		<div class="ui grid">
			<div class="eight wide column middle aligned">
				<div class="ui tiny buttons">
					<button
						class="ui blue basic button"
						class:loading={$securityApiKeys.loading}
						class:inverted
						onclick={onRefresh}
					>
						<i class="sync icon"></i> Refresh
					</button>
				</div>
				<ButtonTinyBasic
					label="Create"
					color="green"
					loading={$securityApiKeys.loading}
					onClick={showCreateKeyDialog}
				/>
			</div>
			<div class="eight wide column right aligned">
				<div class="ui horizontal list">
					{#if $securityApiKeys.scope === 'own'}
						<div class="item">
							<span
								class="ui grey text"
								title="Listing every key on the cluster needs the manage_api_key or manage_security privilege."
							>
								own keys only
								<i class="question circle outline icon"></i>
							</span>
						</div>
					{/if}
					{#if hiddenCount > 0}
						<div class="item">
							<span
								class="ui grey text"
								title="Elasticsearch has no delete for API keys. An invalidated key stays in the listing until the cluster's retention period expires it, seven days by default."
							>
								{hiddenCount} invalidated hidden
								<i class="question circle outline icon"></i>
							</span>
						</div>
					{/if}
					<div class="item">
						<div class="ui checkbox" class:inverted>
							<input
								id="show-invalidated"
								type="checkbox"
								checked={showInvalidated}
								onchange={onShowInvalidatedChange}
							/>
							<label for="show-invalidated">Show invalidated</label>
						</div>
					</div>
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

	<SecurityList
		columns={COLUMNS}
		rows={data}
		{sorting}
		{onSort}
		Cell={ApiKeyCell}
		loading={$securityApiKeys.loading}
		loaded={$securityApiKeys.loaded}
		cause={$securityApiKeys.cause}
		message={$securityApiKeys.message}
		reason={$securityApiKeys.reason}
		entity="API keys"
		emptyMessage="No API keys found"
	/>
</div>
