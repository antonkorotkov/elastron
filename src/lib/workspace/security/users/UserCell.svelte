<script>
	import { getContext } from 'svelte'
	import { useStoreon } from '@storeon/svelte'
	import { refuseUserDelete } from '../guards.js'
	import CappedList from '../CappedList.svelte'

	let { cell = '', i = 0, columns } = $props()

	const { dispatch, securityUsers, securityIdentity } = useStoreon(
		'securityUsers',
		'securityIdentity'
	)
	const { open } = getContext('modal-window')

	let column = $derived(columns[i])
	let user = $derived($securityUsers.entries.find(u => u.username === cell))
	let lockout = $derived(user ? refuseUserDelete(user.username, $securityIdentity) : null)

	const swallow = e => {
		e.preventDefault()
		e.stopPropagation()
	}

	const editUser = async e => {
		swallow(e)
		const Dialog = (await import('./UserDialog.svelte')).default
		open(Dialog, { username: user.username }, { closeOnOuterClick: false })
	}

	const changePassword = async e => {
		swallow(e)
		const Dialog = (await import('./PasswordDialog.svelte')).default
		open(Dialog, { username: user.username }, { closeOnOuterClick: false })
	}

	const toggleEnabled = e => {
		swallow(e)
		dispatch('security/users/setEnabled', {
			username: user.username,
			enabled: !user.enabled,
		})
	}

	const remove = e => {
		swallow(e)
		if (!window.confirm(`Delete the user "${user.username}"? This cannot be undone.`)) return
		dispatch('security/users/delete', { username: user.username })
	}
</script>

{#if column === 'username'}
	<span class="name-cell">
		{cell}
		{#if user?.reserved}
			<span class="ui tiny label" title="Reserved by Elasticsearch. Only its password can be changed.">reserved</span>
		{/if}
		{#if user}
			<button class="cell-action" onclick={changePassword} title="Change password">
				<i class="key icon"></i>
			</button>
			{#if !user.reserved}
				<button class="cell-action" onclick={editUser} title="Edit user">
					<i class="edit outline icon"></i>
				</button>
				<button
					class="cell-action"
					onclick={toggleEnabled}
					title={user.enabled ? 'Disable user' : 'Enable user'}
				>
					<i class="{user.enabled ? 'ban' : 'check circle outline'} icon"></i>
				</button>
				{#if !lockout}
					<button class="cell-action" onclick={remove} title="Delete user">
						<i class="trash alternate outline icon"></i>
					</button>
				{/if}
			{/if}
		{/if}
	</span>
{:else if column === 'roles'}
	<!-- A user can hold dozens of roles; the same cap as the roles table. -->
	<CappedList text={cell} empty="none" />
{:else if column === 'enabled'}
	{#if cell === 'yes'}
		<i class="check circle green icon" title="Enabled"></i>
	{:else}
		<i class="ban red icon" title="Disabled"></i>
	{/if}
{:else}{cell}{/if}

<style>
	.name-cell {
		display: inline-flex;
		align-items: center;
		gap: 0.4em;
	}
</style>
