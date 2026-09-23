<script>
	import { getContext } from 'svelte'
	import { useStoreon } from '@storeon/svelte'
	import { isThemeToggleChecked } from '$lib/utils/helpers'

	let { username } = $props()

	const { close } = getContext('modal-window')
	const { dispatch, app } = useStoreon('app')
	let inverted = $derived(isThemeToggleChecked($app.theme))

	let password = $state('')
	let confirmation = $state('')

	let longEnough = $derived(password.length >= 6)
	let matches = $derived(password === confirmation)
	let canSave = $derived(longEnough && matches)

	const save = e => {
		e?.preventDefault()
		if (!canSave) return
		dispatch('security/users/password', { username, password })
		close()
	}
</script>

<div class="ui header">Change Password For {username}</div>

<div class="content">
	<form class="ui form" class:inverted onsubmit={save} id="password-form">
		<div class="field">
			<label for="pw-new">New Password</label>
			<input type="password" id="pw-new" bind:value={password} autocomplete="new-password" />
			{#if password && !longEnough}
				<span class="ui grey text">Elasticsearch requires at least 6 characters.</span>
			{/if}
		</div>
		<div class="field">
			<label for="pw-confirm">Confirm Password</label>
			<input
				type="password"
				id="pw-confirm"
				bind:value={confirmation}
				autocomplete="new-password"
			/>
			{#if confirmation && !matches}
				<span class="ui grey text">The two passwords do not match.</span>
			{/if}
		</div>
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
		form="password-form"
		disabled={!canSave}
	>
		Change Password
	</button>
</div>
