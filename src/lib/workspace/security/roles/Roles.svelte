<script>
	import { onMount, getContext } from 'svelte'
	import { useStoreon } from '@storeon/svelte'
	import debounce from 'lodash/debounce.js'

	import { isThemeToggleChecked } from '$lib/utils/helpers'
	import { searchAndSortRoles } from '$lib/security/roleSearch.js'
	import { roleSortDirection } from '$lib/store/elasticsearch/securityRoles.js'
	import SecurityList from '../SecurityList.svelte'
	import RoleCell from './RoleCell.svelte'
	import ButtonTinyBasic from '$lib/components/buttons/ButtonTinyBasic.svelte'

	const { dispatch, app, securityRoles } = useStoreon('app', 'securityRoles')
	const { open } = getContext('modal-window')

	let inverted = $derived(isThemeToggleChecked($app.theme))

	const COLUMNS = ['role', 'cluster privileges', 'indices', 'run as']

	let entries = $derived($securityRoles.entries)
	let search = $derived($securityRoles.search)
	let direction = $derived(roleSortDirection($securityRoles))
	let sorting = $derived([direction, 'role', 0])
	let paged = $derived($securityRoles.mode !== 'full')
	let busy = $derived($securityRoles.loading || $securityRoles.loadingMore)

	// The cluster searches and sorts a paged list; a whole list from a cluster
	// that cannot page is searched and sorted here by the same rules.
	let shown = $derived(paged ? entries : searchAndSortRoles(entries, search, direction))

	let countLabel = $derived(
		paged && $securityRoles.total != null
			? `${entries.length} of ${$securityRoles.total}`
			: `${shown.length} ${shown.length === 1 ? 'item' : 'items'}`
	)

	// Role names on a real cluster are often generated identifiers that carry
	// no meaning, so search leads and the labels in the name cell do the
	// explaining.
	let data = $derived(
		shown.map(r => [
			r.name,
			(r.cluster || []).join(', '),
			// Flattened to unique patterns: the block a pattern came from does not
			// help when scanning a list, and one separator keeps the cell simple
			// to cap.
			[...new Set((r.indices || []).flatMap(b => b.names || []))].join(', '),
			(r.run_as || []).join(', '),
		])
	)

	const onRefresh = () => dispatch('security/roles/fetch')

	const onSearchChange = debounce(e => dispatch('security/roles/search', e.target.value), 300)

	// The cluster can only order roles by name.
	const onSort = (column, _index, next) => {
		if (column === 'role') dispatch('security/roles/sort', next)
	}

	const onEndReached = () => dispatch('security/roles/more')

	const showCreateRoleDialog = async () => {
		const Dialog = (await import('./RoleDialog.svelte')).default
		open(Dialog, { name: null }, { closeOnOuterClick: false })
	}

	onMount(() => {
		onRefresh()
		dispatch('security/privileges/fetch')
	})
</script>

<div class="ui segments">
	<div class="ui segment" class:inverted>
		<div class="ui grid">
			<div class="eight wide column middle aligned">
				<div class="ui tiny buttons">
					<button
						class="ui blue basic button"
						class:loading={busy}
						class:inverted
						onclick={onRefresh}
					>
						<i class="sync icon"></i> Refresh
					</button>
				</div>
				<ButtonTinyBasic
					label="Create"
					color="green"
					loading={busy}
					onClick={showCreateRoleDialog}
				/>
			</div>
			<div class="eight wide column right aligned">
				<div class="ui horizontal list">
					<div class="item">
						<span class="ui grey text">
							{countLabel}
						</span>
					</div>
					<div class="item">
						<div class="ui search">
							<div class="ui icon input" class:inverted>
								<input
									class="prompt"
									onkeyup={onSearchChange}
									type="text"
									placeholder="Search names and descriptions…"
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
		Cell={RoleCell}
		loading={$securityRoles.loading}
		loaded={$securityRoles.loaded}
		cause={$securityRoles.cause}
		message={$securityRoles.message}
		reason={$securityRoles.reason}
		entity="roles"
		emptyMessage="No roles found"
		hasEntries={entries.length > 0}
		{onEndReached}
	/>
</div>

