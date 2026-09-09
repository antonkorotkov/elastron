<script>
	/**
	 * @typedef {Object} Props
	 * @property {string} [cell]
	 * @property {number} [i]
	 * @property {any} columns
	 */

	/** @type {Props} */
	let { cell = '', i = 0, columns } = $props()

	import { useStoreon } from '@storeon/svelte'
	import { goto } from '$app/navigation'
	import { resolve } from '$app/paths'

	const { dispatch, search } = useStoreon('search')

	let copied = $state(false)

	// The action buttons sit inside the index link's cell, so a click must
	// neither follow the link nor reach whatever the row does with clicks.
	const swallow = e => {
		e.preventDefault()
		e.stopPropagation()
	}

	const copyToClipboard = async e => {
		swallow(e)
		await navigator.clipboard.writeText(cell)
		copied = true
		setTimeout(() => (copied = false), 1500)
	}

	// The store refuses to open a tab at the cap and leaves the active tab as
	// it was, so the user only moves to Search when a tab actually opened.
	const openInSearch = e => {
		swallow(e)
		const before = $search.activeId
		dispatch('search/tabs/open', { index: cell })
		if ($search.activeId !== before) goto(resolve('/search'))
	}
</script>

{#if columns[i] === 'health'}
	<div class="ui center aligned">
		<i class="ui label circular empty {cell}"></i>
	</div>
{:else if columns[i] === 'index'}
	<span class="index-cell">
		<a href={resolve(`/index/${cell}`)}>{cell}</a>
		<button
			class="cell-action"
			class:copied
			onclick={copyToClipboard}
			title="Copy index name"
		>
			<i class="{copied ? 'check' : 'copy outline'} icon"></i>
		</button>
		<button
			class="cell-action"
			onclick={openInSearch}
			title="Open in search"
		>
			<i class="search icon"></i>
		</button>
	</span>
{:else}{cell}{/if}

<style>
	.index-cell {
		display: inline-flex;
		align-items: center;
		gap: 0.4em;
	}

	.cell-action {
		background: none;
		border: none;
		cursor: pointer;
		padding: 0;
		margin: 0;
		opacity: 0;
		transition: opacity 0.15s ease;
		color: inherit;
		font-size: 0.9em;
		line-height: 1;
		display: inline-flex;
		align-items: center;
	}

	.cell-action.copied {
		opacity: 1;
		color: #21ba45;
	}

	.index-cell:hover .cell-action {
		opacity: 0.5;
	}

	.cell-action:hover {
		opacity: 1 !important;
	}
</style>
