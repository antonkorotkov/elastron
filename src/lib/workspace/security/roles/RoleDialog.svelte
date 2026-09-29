<script>
	import { getContext } from 'svelte'
	import { useStoreon } from '@storeon/svelte'
	import API from '$lib/api/elasticsearch'
	import { isThemeToggleChecked } from '$lib/utils/helpers'
	import { toRoleEntries } from '$lib/store/elasticsearch/securityList.js'
	import RoleEditor from './RoleEditor.svelte'

	// Loads the role by name rather than trusting a loaded row, so the editor
	// always starts from the cluster's current definition.
	let { name = null } = $props()

	const { close } = getContext('modal-window')
	const { app, connection } = useStoreon('app', 'connection')

	let inverted = $derived(isThemeToggleChecked($app.theme))

	const load = async () => {
		const found = await new API($connection, $app.windowId).getSecurityRolesByName([name])
		const role = toRoleEntries(found).find(r => r.name === name)
		if (!role) throw new Error('This role no longer exists on the cluster.')
		return role
	}

	// svelte-ignore state_referenced_locally
	const loading = name ? load() : null
</script>

{#if !loading}
	<RoleEditor {name} />
{:else}
	{#await loading}
		<div class="ui header">{name}</div>
		<div class="content">
			<div class="ui active inline centered loader" data-testid="role-loading"></div>
		</div>
		<div class="actions">
			<button type="button" class="ui black deny button right" class:inverted onclick={close}>
				Cancel
			</button>
		</div>
	{:then existing}
		<RoleEditor {name} {existing} />
	{:catch err}
		<div class="ui header">{name}</div>
		<div class="content">
			<div class="ui small warning message">
				{err?.message || 'The role could not be loaded.'}
			</div>
		</div>
		<div class="actions">
			<button type="button" class="ui black deny button right" class:inverted onclick={close}>
				Close
			</button>
		</div>
	{/await}
{/if}
