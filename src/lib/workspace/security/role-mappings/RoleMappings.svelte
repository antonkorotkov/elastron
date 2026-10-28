<script>
	import { onMount, getContext } from 'svelte'
	import { useStoreon } from '@storeon/svelte'
	import orderBy from 'lodash/orderBy.js'
	import debounce from 'lodash/debounce.js'

	import { isThemeToggleChecked, filterArrayBy } from '$lib/utils/helpers'
	import SecurityList from '../SecurityList.svelte'
	import RoleMappingCell from './RoleMappingCell.svelte'
	import ButtonTinyBasic from '$lib/components/buttons/ButtonTinyBasic.svelte'

	const { dispatch, app, securityRoleMappings } = useStoreon('app', 'securityRoleMappings')
	const { open } = getContext('modal-window')

	let inverted = $derived(isThemeToggleChecked($app.theme))

	const COLUMNS = ['name', 'roles', 'rules', 'enabled']

	let entries = $derived($securityRoleMappings.entries)
	let search = $derived($securityRoleMappings.search)
	let sorting = $derived($securityRoleMappings.sorting)

	let data = $derived.by(() => {
		let list = entries.map(m => [
			m.name,
			m.usesTemplates ? 'template' : (m.roles || []).join(', '),
			m.rulesText,
			m.enabled ? 'yes' : 'no',
		])

		const [direction, , index] = sorting
		if (direction && index !== undefined) {
			list = orderBy(list, [row => String(row[index]).toLowerCase()], [direction])
		}
		if (search) list = filterArrayBy(list, search)
		return list
	})

	const onRefresh = () => dispatch('security/roleMappings/fetch')

	const onSearchChange = debounce(
		e => dispatch('security/roleMappings/update', { search: e.target.value }),
		300
	)

	const onSort = (column, index, direction) =>
		dispatch('security/roleMappings/update', { sorting: [direction, column, index] })

	const showCreateDialog = async () => {
		const Dialog = (await import('./RoleMappingDialog.svelte')).default
		open(Dialog, { name: null }, { closeOnOuterClick: false })
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
						class:loading={$securityRoleMappings.loading}
						class:inverted
						onclick={onRefresh}
					>
						<i class="sync icon"></i> Refresh
					</button>
				</div>
				<ButtonTinyBasic
					label="Create"
					color="green"
					loading={$securityRoleMappings.loading}
					onClick={showCreateDialog}
				/>
			</div>
			<div class="eight wide column right aligned">
				<div class="ui horizontal list">
					<div class="item">
						<span
							class="ui grey text"
							title="Mappings defined in a realm's role mapping file are applied by the cluster but never reported through its API, so they cannot be listed here."
						>
							File-based mappings not shown
						</span>
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
		Cell={RoleMappingCell}
		loading={$securityRoleMappings.loading}
		loaded={$securityRoleMappings.loaded}
		cause={$securityRoleMappings.cause}
		message={$securityRoleMappings.message}
		reason={$securityRoleMappings.reason}
		entity="role mappings"
		emptyMessage="No role mappings found"
		hasEntries={entries.length > 0}
	/>
</div>
