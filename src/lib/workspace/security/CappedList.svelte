<script>
	/**
	 * A comma-separated list shown in a table cell, capped to a few values.
	 *
	 * A reserved role such as `kibana_system` grants hundreds of index
	 * patterns, and a user can hold dozens of roles. Printing them all made one
	 * row taller than the window and broke the virtualised table, whose rows
	 * are measured against a uniform estimate. Only the first few are shown,
	 * with the rest behind a count.
	 *
	 * The caller keeps the full text in its row data, so searching for a value
	 * this does not display still matches.
	 */
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
	/* One line per cell, whatever the row holds, so every row keeps the height
	   the virtualised table assumes. */
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
		/* Ellipsis needs a bound to work against, and this keeps one long value
		   from pushing the other columns off screen. */
		max-width: 28vw;
	}

	.more {
		flex: 0 0 auto;
		cursor: help;
	}
</style>
