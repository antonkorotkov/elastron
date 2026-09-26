<script>
	import { onMount, getContext } from 'svelte'
	import { useStoreon } from '@storeon/svelte'
	import orderBy from 'lodash/orderBy.js'
	import debounce from 'lodash/debounce.js'

	import { isThemeToggleChecked, filterArrayBy } from '$lib/utils/helpers'
	import SecurityList from '../SecurityList.svelte'
	import RoleCell from './RoleCell.svelte'
	import ButtonTinyBasic from '$lib/components/buttons/ButtonTinyBasic.svelte'

	const { dispatch, app, securityRoles } = useStoreon('app', 'securityRoles')
	const { open } = getContext('modal-window')

	let inverted = $derived(isThemeToggleChecked($app.theme))

	const COLUMNS = ['role', 'cluster privileges', 'indices', 'run as']

	let entries = $derived($securityRoles.entries)
	let search = $derived($securityRoles.search)
	let sorting = $derived($securityRoles.sorting)

	// Role names on a real cluster are often generated identifiers that carry
	// no meaning, so search leads and the labels in the name cell do the
	// explaining.
	let data = $derived.by(() => {
		let list = entries.map(r => [
			r.name,
			(r.cluster || []).join(', '),
			// Flattened to unique patterns: the block a pattern came from does not
			// help when scanning a list, and one separator keeps the cell simple
			// to cap. The whole string stays in the row so search still matches a
			// pattern the cell does not show.
			[...new Set((r.indices || []).flatMap(b => b.names || []))].join(', '),
			(r.run_as || []).join(', '),
		])

		const [direction, , index] = sorting
		if (direction && index !== undefined) {
			list = orderBy(list, [row => String(row[index]).toLowerCase()], [direction])
		}
		if (search) list = filterArrayBy(list, search)
		return list
	})

	const onRefresh = () => dispatch('security/roles/fetch')

	const onSearchChange = debounce(
		e => dispatch('security/roles/update', { search: e.target.value }),
		300
	)

	const onSort = (column, index, direction) =>
		dispatch('security/roles/update', { sorting: [direction, column, index] })

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
						class:loading={$securityRoles.loading}
						class:inverted
						onclick={onRefresh}
					>
						<i class="sync icon"></i> Refresh
					</button>
				</div>
				<ButtonTinyBasic
					label="Create"
					color="green"
					loading={$securityRoles.loading}
					onClick={showCreateRoleDialog}
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
	/>
</div>
