<script>
	import { onMount, getContext } from 'svelte'
	import { useStoreon } from '@storeon/svelte'
	import orderBy from 'lodash/orderBy.js'
	import debounce from 'lodash/debounce.js'

	import { isThemeToggleChecked, filterArrayBy } from '$lib/utils/helpers'
	import SecurityList from '../SecurityList.svelte'
	import UserCell from './UserCell.svelte'
	import ButtonTinyBasic from '$lib/components/buttons/ButtonTinyBasic.svelte'

	const { dispatch, app, securityUsers, securityRoles } = useStoreon(
		'app',
		'securityUsers',
		'securityRoles'
	)
	const { open } = getContext('modal-window')

	let inverted = $derived(isThemeToggleChecked($app.theme))

	const COLUMNS = ['username', 'roles', 'full name', 'email', 'enabled']

	let entries = $derived($securityUsers.entries)
	let search = $derived($securityUsers.search)
	let sorting = $derived($securityUsers.sorting)

	let data = $derived.by(() => {
		let list = entries.map(u => [
			u.username,
			(u.roles || []).join(', '),
			u.full_name || '',
			u.email || '',
			u.enabled ? 'yes' : 'no',
		])

		const [direction, , index] = sorting
		if (direction && index !== undefined) {
			list = orderBy(list, [row => String(row[index]).toLowerCase()], [direction])
		}
		if (search) list = filterArrayBy(list, search)
		return list
	})

	const onRefresh = () => dispatch('security/users/fetch')

	const onSearchChange = debounce(
		e => dispatch('security/users/update', { search: e.target.value }),
		300
	)

	const onSort = (column, index, direction) =>
		dispatch('security/users/update', { sorting: [direction, column, index] })

	const showCreateUserDialog = async () => {
		const Dialog = (await import('./UserDialog.svelte')).default
		open(Dialog, { username: null }, { closeOnOuterClick: false })
	}

	onMount(() => {
		onRefresh()
		// The role catalogue backs the editor's role picker and the self-lockout
		// guard, which has to know which roles manage security. A failed read
		// still marks the list loaded, so this is not conditional on that.
		dispatch('security/roles/fetch')
	})
</script>

<div class="ui segments">
	<div class="ui segment" class:inverted>
		<div class="ui grid">
			<div class="eight wide column middle aligned">
				<div class="ui tiny buttons">
					<button
						class="ui blue basic button"
						class:loading={$securityUsers.loading}
						class:inverted
						onclick={onRefresh}
					>
						<i class="sync icon"></i> Refresh
					</button>
				</div>
				<ButtonTinyBasic
					label="Create"
					color="green"
					loading={$securityUsers.loading}
					onClick={showCreateUserDialog}
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
		Cell={UserCell}
		loading={$securityUsers.loading}
		loaded={$securityUsers.loaded}
		cause={$securityUsers.cause}
		message={$securityUsers.message}
		reason={$securityUsers.reason}
		entity="users"
		emptyMessage="No users found"
			hasEntries={entries.length > 0}
	/>
</div>
