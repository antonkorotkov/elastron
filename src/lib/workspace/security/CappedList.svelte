<script>
	// Capped because a reserved role can grant hundreds of index patterns, and
	// one tall row breaks VirtualTable's uniform height estimate. The caller
	// keeps the full text so search still matches what is not shown.
	let { text = '', shown = 3, inTooltip = 15, empty = '—', hint = '' } = $props()

	let values = $derived(
		String(text || '')
			.split(', ')
			.map(value => value.trim())
			.filter(Boolean)
	)
	let visible = $derived(values.slice(0, shown))
	let hidden = $derived(Math.max(0, values.length - shown))

	let overflowTitle = $derived.by(() => {
		const rest = values.slice(shown)
		const listed = rest.slice(0, inTooltip).join('\n')
		const remainder = rest.length - inTooltip
		const tail = remainder > 0 ? `…and ${remainder} more.` : ''
		return [listed, [tail, hint].filter(Boolean).join(' ')].filter(Boolean).join('\n')
	})
</script>

{#if values.length === 0}
	<span class="ui grey text">{empty}</span>
{:else}
	<span class="capped">
		<span class="listed">{visible.join(', ')}</span>
		{#if hidden}
			<span class="ui tiny label more" title={overflowTitle}>+{hidden}</span>
		{/if}
	</span>
{/if}

<style>
	.capped {
		display: flex;
		align-items: center;
		gap: 0.4em;
		min-width: 0;
	}

	.listed {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		/* Ellipsis needs a bound to work against. */
		max-width: 28vw;
	}

	.more {
		flex: 0 0 auto;
		cursor: help;
	}
</style>
