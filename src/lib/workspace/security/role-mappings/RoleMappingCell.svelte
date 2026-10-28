<script>
	import { getContext } from 'svelte'
	import { useStoreon } from '@storeon/svelte'
	import CappedList from '../CappedList.svelte'
	import { refuseMappingChange } from '../guards.js'

	let { cell = '', i = 0, columns, row = [] } = $props()

	const { dispatch, securityRoleMappings, securityIdentity } = useStoreon(
		'securityRoleMappings',
		'securityIdentity'
	)
	const { open } = getContext('modal-window')

	let column = $derived(columns[i])
	let entries = $derived($securityRoleMappings.entries)
	// Every column needs the mapping, and only the name column holds its name.
	let mapping = $derived(entries.find(m => m.name === row[0]))

	// The store repeats these checks against the cluster before sending; here
	// they only decide what the row offers and what the prompt says.
	const judge = after =>
		refuseMappingChange(
			mapping,
			after,
			entries.filter(m => m !== mapping),
			$securityIdentity,
			$securityRoleMappings.catalogue
		)

	let actionable = $derived(Boolean(mapping) && column === 'name' && !mapping.readOnly)
	let deleteVerdict = $derived(actionable ? judge(null) : null)
	let toggleVerdict = $derived(actionable ? judge({ ...mapping, enabled: !mapping.enabled }) : null)

	let templatesTitle = $derived(
		(mapping?.role_templates || []).map(t => (typeof t.template === 'string' ? t.template : JSON.stringify(t.template))).join('\n')
	)

	const swallow = e => {
		e.preventDefault()
		e.stopPropagation()
	}

	const openEditor = async e => {
		swallow(e)
		const Dialog = (await import('./RoleMappingDialog.svelte')).default
		open(Dialog, { name: mapping.name }, { closeOnOuterClick: false })
	}

	const toggleEnabled = e => {
		swallow(e)
		const enabled = !mapping.enabled
		if (toggleVerdict && !window.confirm(`${toggleVerdict.message}\n\nDisable the role mapping "${mapping.name}" anyway?`)) return
		dispatch('security/roleMappings/setEnabled', { name: mapping.name, enabled, acknowledged: Boolean(toggleVerdict) })
	}

	const remove = e => {
		swallow(e)
		const warning = deleteVerdict ? `\n\n${deleteVerdict.message}` : ''
		if (!window.confirm(`Delete the role mapping "${mapping.name}"? This cannot be undone.${warning}`)) return
		dispatch('security/roleMappings/delete', { name: mapping.name, acknowledged: Boolean(deleteVerdict) })
	}
</script>

{#if column === 'name'}
	<span class="name-cell">
		{cell}
		{#if mapping?.readOnly}
			<span class="ui tiny label" title="Defined in the cluster's operator settings. It can only be viewed here.">read-only</span>
		{/if}
		{#if mapping}
			<button class="cell-action" onclick={openEditor} title={mapping.readOnly ? 'View role mapping' : 'Edit role mapping'}>
				<i class="{mapping.readOnly ? 'eye' : 'edit outline'} icon"></i>
			</button>
			{#if !mapping.readOnly}
				{#if toggleVerdict?.level !== 'refuse'}
					<button
						class="cell-action"
						onclick={toggleEnabled}
						title={mapping.enabled ? 'Disable role mapping' : 'Enable role mapping'}
					>
						<i class="{mapping.enabled ? 'ban' : 'check circle outline'} icon"></i>
					</button>
				{/if}
				{#if deleteVerdict?.level !== 'refuse'}
					<button class="cell-action" onclick={remove} title="Delete role mapping">
						<i class="trash alternate outline icon"></i>
					</button>
				{/if}
			{/if}
		{/if}
	</span>
{:else if column === 'roles'}
	{#if mapping?.usesTemplates}
		<span class="ui tiny label" title={templatesTitle}>template</span>
	{:else}
		<CappedList text={cell} empty="none" hint="Open the mapping to see them all." />
	{/if}
{:else if column === 'rules'}
	<span class="rules" title={cell}>{cell}</span>
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

	.rules {
		display: block;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		/* Ellipsis needs a bound to work against. */
		max-width: 40vw;
	}
</style>
