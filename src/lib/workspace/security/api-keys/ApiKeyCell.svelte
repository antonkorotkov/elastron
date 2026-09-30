<script>
	import { useStoreon } from '@storeon/svelte'

	let { cell = '', i = 0, columns, row = null } = $props()

	const { dispatch, securityApiKeys } = useStoreon('securityApiKeys')

	let column = $derived(columns[i])

	// Keys can share a name, so the record is found from the whole row: name,
	// owner and creation timestamp together identify one key.
	let key = $derived.by(() => {
		if (!row) return null
		const [name, username, created] = row
		return (
			$securityApiKeys.entries.find(
				k =>
					(k.name || '—') === name &&
					(k.username || '—') === username &&
					new Date(k.creation).toLocaleString() === created
			) || null
		)
	})

	const remove = e => {
		e.preventDefault()
		e.stopPropagation()
		if (!window.confirm(`Invalidate the API key "${key.name || key.id}"? It stops working immediately and cannot be re-enabled. Elasticsearch has no delete for API keys, so it stays listed until the cluster's retention period clears it.`)) return
		dispatch('security/api-keys/invalidate', { id: key.id, name: key.name })
	}
</script>

{#if column === 'status'}
	{#if cell === 'invalidated'}
		<span
			class="ui tiny red label"
			title="Elasticsearch has no delete for API keys. This one no longer works, and the cluster removes it once its retention period expires, seven days by default."
		>
			invalidated
		</span>
	{:else if cell === 'expired'}
		<span class="ui tiny label">expired</span>
	{:else}
		<span class="ui tiny green label">active</span>
	{/if}
{:else if column === 'name'}
	<span class="name-cell">
		{cell}
		{#if key && !key.invalidated}
			<!-- A ban icon, not a trash can: this revokes the key, it does not
			     delete it. Elasticsearch offers no delete for API keys. -->
			<button class="cell-action" onclick={remove} title="Invalidate key">
				<i class="ban icon"></i>
			</button>
		{/if}
	</span>
{:else}{cell}{/if}

<style>
	.name-cell {
		display: inline-flex;
		align-items: center;
		gap: 0.4em;
	}
</style>
