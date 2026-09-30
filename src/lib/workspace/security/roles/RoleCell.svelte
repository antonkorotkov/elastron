<script>
	import { getContext } from 'svelte'
	import { useStoreon } from '@storeon/svelte'
	import CappedList from '../CappedList.svelte'

	let { cell = '', i = 0, columns } = $props()

	const { dispatch, securityRoles } = useStoreon('securityRoles')
	const { open } = getContext('modal-window')

	let column = $derived(columns[i])
	let role = $derived($securityRoles.entries.find(r => r.name === cell))

	// A reserved role can grant hundreds of index patterns and two dozen
	// cluster privileges, so these are capped. The row keeps the full text, so
	// searching for a value the cell does not show still finds the role.
	const LIST_COLUMNS = new Set(['cluster privileges', 'indices', 'run as'])

	const swallow = e => {
		e.preventDefault()
		e.stopPropagation()
	}

	const openEditor = async e => {
		swallow(e)
		const Dialog = (await import('./RoleDialog.svelte')).default
		open(Dialog, { name: role.name }, { closeOnOuterClick: false })
	}

	const remove = e => {
		swallow(e)
		if (!window.confirm(`Delete the role "${role.name}"? This cannot be undone.`)) return
		dispatch('security/roles/delete', { name: role.name })
	}
</script>

{#if column === 'role'}
	<span class="name-cell">
		{cell}
		{#if role?.reserved}
			<span class="ui tiny label" title="Reserved by Elasticsearch. It cannot be edited or deleted.">reserved</span>
		{/if}
		{#if role?.hasDocumentQuery}
			<span class="ui tiny purple label" title="Restricts which documents this role can see">documents</span>
		{/if}
		{#if role?.hasFieldSecurity}
			<span class="ui tiny purple label" title="Restricts which fields this role can see">fields</span>
		{/if}
		{#if role}
			<button class="cell-action" onclick={openEditor} title={role.reserved ? 'View role' : 'Edit role'}>
				<i class="{role.reserved ? 'eye' : 'edit outline'} icon"></i>
			</button>
			{#if !role.reserved}
				<button class="cell-action" onclick={remove} title="Delete role">
					<i class="trash alternate outline icon"></i>
				</button>
			{/if}
		{/if}
	</span>
{:else if LIST_COLUMNS.has(column)}
	<CappedList text={cell} hint="Open the role to see them all." />
{:else}{cell}{/if}

<style>
	.name-cell {
		display: inline-flex;
		align-items: center;
		gap: 0.4em;
	}
</style>
