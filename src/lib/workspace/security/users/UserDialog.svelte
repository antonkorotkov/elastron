<script>
	import { getContext } from 'svelte'
	import { useStoreon } from '@storeon/svelte'
	import { isThemeToggleChecked } from '$lib/utils/helpers'
	import AdvancedDropdown from '$lib/components/inputs/AdvancedDropdown.svelte'
	import { refuseUserRoleChange } from '../guards.js'

	let { username = null } = $props()

	const { close } = getContext('modal-window')
	const { dispatch, app, securityUsers, securityRoles, securityIdentity } = useStoreon(
		'app',
		'securityUsers',
		'securityRoles',
		'securityIdentity'
	)

	let inverted = $derived(isThemeToggleChecked($app.theme))
	let isNew = $derived(!username)

	const existing = $securityUsers.entries.find(u => u.username === username)

	// Captured once on open by design; the field is the user's from here on.
	// svelte-ignore state_referenced_locally
	let name = $state(username || '')
	let password = $state('')
	let fullName = $state(existing?.full_name || '')
	let email = $state(existing?.email || '')
	let roles = $state([...(existing?.roles || [])])

	let availableRoles = $derived(
		$securityRoles.entries.map(r => r.name).sort((a, b) => a.localeCompare(b))
	)

	const catalogue = $derived(Object.fromEntries($securityRoles.entries.map(r => [r.name, r])))
	let lockout = $derived(refuseUserRoleChange(name, roles, $securityIdentity, catalogue))

	let nameOk = $derived(!isNew || Boolean(name.trim()))
	let passwordOk = $derived(!isNew || password.length >= 6)
	let canSave = $derived(nameOk && passwordOk && !lockout)

	const save = e => {
		e?.preventDefault()
		if (!canSave) return

		const body = {
			roles,
			full_name: fullName || null,
			email: email || null,
		}
		// A password is only sent when creating, or when one was typed. Updating
		// a user without it leaves the existing password alone.
		if (password) body.password = password

		dispatch('security/users/put', { username: name.trim(), body, isNew })
		close()
	}
</script>

<div class="ui header">{isNew ? 'Create New User' : `Edit ${username}`}</div>

<div class="content">
	<form class="ui form" class:inverted onsubmit={save} id="user-form">
		{#if isNew}
			<div class="field">
				<label for="user-name">Username</label>
				<input type="text" id="user-name" bind:value={name} autocomplete="off" />
			</div>
		{/if}

		<div class="field">
			<label for="user-password">
				Password
				{#if !isNew}<span class="ui grey text">leave blank to keep the current one</span>{/if}
			</label>
			<input
				type="password"
				id="user-password"
				bind:value={password}
				autocomplete="new-password"
			/>
			{#if isNew && !passwordOk}
				<span class="ui grey text">Elasticsearch requires at least 6 characters.</span>
			{/if}
		</div>

		<div class="two fields">
			<div class="field">
				<label for="user-fullname">Full Name</label>
				<input type="text" id="user-fullname" bind:value={fullName} />
			</div>
			<div class="field">
				<label for="user-email">Email</label>
				<input type="text" id="user-email" bind:value={email} />
			</div>
		</div>

		<div class="field">
			<!-- A cluster can hold hundreds of roles with generated names, so this
			     is a searchable multi-select rather than a list of checkboxes. -->
			<label for="user-roles">Roles</label>
			<AdvancedDropdown
				items={availableRoles}
				selectedValue={roles}
				multiple
				isCreatable={false}
				isClearable
				placeholder={availableRoles.length
					? 'Search roles…'
					: 'No roles could be read from this cluster'}
				isDisabled={availableRoles.length === 0}
				onChange={picked => (roles = picked)}
				floatingConfig={{ strategy: 'fixed' }}
			/>
			{#if roles.length}
				<span class="ui grey text">{roles.length} selected</span>
			{/if}
		</div>

		{#if lockout}
			<div class="ui small warning message">{lockout}</div>
		{/if}
	</form>
</div>

<div class="actions">
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<div
		class="ui black deny button right"
		class:inverted
		onclick={close}
		role="button"
		tabindex="0"
	>
		Cancel
	</div>
	<button
		type="submit"
		class="ui green right button"
		class:inverted
		form="user-form"
		disabled={!canSave}
	>
		{isNew ? 'Create' : 'Save'}
	</button>
</div>
