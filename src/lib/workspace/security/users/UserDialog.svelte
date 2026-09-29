<script>
	import { getContext, untrack } from 'svelte'
	import { useStoreon } from '@storeon/svelte'
	import { isThemeToggleChecked } from '$lib/utils/helpers'
	import API from '$lib/api/elasticsearch'
	import AdvancedDropdown from '$lib/components/inputs/AdvancedDropdown.svelte'
	import { ROLE_PAGE_SIZE, searchAndSortRoles } from '$lib/security/roleSearch.js'
	import { toRoleEntries } from '$lib/store/elasticsearch/securityList.js'
	import { isSelf, refuseUserRoleChange } from '../guards.js'

	let { username = null } = $props()

	const { close } = getContext('modal-window')
	const { dispatch, app, connection, securityUsers, securityIdentity } = useStoreon(
		'app',
		'connection',
		'securityUsers',
		'securityIdentity'
	)

	let inverted = $derived(isThemeToggleChecked($app.theme))
	let isNew = $derived(!username)

	const existing = $securityUsers.entries.find(u => u.username === username)

	// svelte-ignore state_referenced_locally
	let name = $state(username || '')
	let password = $state('')
	let fullName = $state(existing?.full_name || '')
	let email = $state(existing?.email || '')
	let roles = $state([...(existing?.roles || [])])

	// The cluster may hold thousands of roles, so the picker asks it for the
	// ones matching what was typed. A cluster that cannot page answers the first
	// question with the whole list, which every later search waits on and
	// filters here, rather than downloading it again while it is still arriving.
	let first = null
	let rolesError = $state('')

	const ask = text => new API($connection, $app.windowId).querySecurityRoles({ search: text })

	const findRoles = async text => {
		try {
			first ??= { text, answer: ask(text) }
			const opening = await first.answer
			const answer =
				opening?.mode === 'full' || first.text === text ? opening : await ask(text)

			const entries = toRoleEntries(answer?.roles)
			const found = answer?.mode === 'full' ? searchAndSortRoles(entries, text) : entries
			rolesError = ''
			return found.map(r => r.name).slice(0, ROLE_PAGE_SIZE)
		} catch (err) {
			first = null
			rolesError = err?.message || 'Roles could not be read from this cluster.'
			return []
		}
	}

	// Definitions for the roles the self-lockout guard has to judge, fetched as
	// they come into play. A role the cluster does not return stays out of the
	// catalogue, which the guard treats cautiously; the store repeats the check
	// with a fresh lookup before sending.
	let definitions = $state({})
	let editingSelf = $derived(isSelf(name, $securityIdentity))

	$effect(() => {
		if (!editingSelf) return
		const known = untrack(() => definitions)
		const wanted = [...new Set([...($securityIdentity.roles || []), ...roles])].filter(
			role => !(role in known)
		)
		if (!wanted.length) return

		const settle = found => {
			definitions = {
				...definitions,
				...Object.fromEntries(wanted.map(role => [role, found?.[role] ?? null])),
			}
		}
		new API($connection, $app.windowId)
			.getSecurityRolesByName(wanted)
			.then(settle, () => settle({}))
	})

	let catalogue = $derived(
		Object.fromEntries(Object.entries(definitions).filter(([, definition]) => definition))
	)
	let lockout = $derived(refuseUserRoleChange(name, roles, $securityIdentity, catalogue))

	// Elasticsearch stores this as free text and never reads it, so a typo
	// would go unnoticed forever. Deliberately loose: it rejects the obvious
	// mistakes without judging unusual addresses.
	const LOOKS_LIKE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
	let emailOk = $derived(!email.trim() || LOOKS_LIKE_EMAIL.test(email.trim()))

	let nameOk = $derived(!isNew || Boolean(name.trim()))
	let passwordOk = $derived(!isNew || password.length >= 6)
	let canSave = $derived(nameOk && passwordOk && emailOk && !lockout)

	const save = e => {
		e?.preventDefault()
		if (!canSave) return

		// The user API replaces the whole document, so leaving a field out
		// loses it: an edit used to re-enable a disabled account and wipe its
		// metadata.
		const body = {
			roles,
			full_name: fullName.trim() || null,
			email: email.trim() || null,
		}

		if (!isNew && existing) {
			body.enabled = existing.enabled
			// Elasticsearch rejects its own underscore-prefixed keys on write.
			const metadata = Object.fromEntries(
				Object.entries(existing.metadata || {}).filter(([key]) => !key.startsWith('_'))
			)
			if (Object.keys(metadata).length) body.metadata = metadata
		}

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
			<div class="field" class:error={!emailOk}>
				<label for="user-email">Email</label>
				<input type="email" id="user-email" bind:value={email} />
				{#if !emailOk}
					<span class="ui grey text">This does not look like an email address.</span>
				{/if}
			</div>
		</div>

		<div class="field">
			<label for="user-roles">Roles</label>
			<AdvancedDropdown
				loadOptions={findRoles}
				selectedValue={roles}
				multiple
				isCreatable={false}
				isClearable
				placeholder="Search roles…"
				onChange={picked => (roles = picked)}
				floatingConfig={{ strategy: 'fixed' }}
			/>
			{#if rolesError}
				<span class="ui grey text">{rolesError}</span>
			{:else if roles.length}
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
