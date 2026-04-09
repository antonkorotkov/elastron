<script>
	/**
	 * @typedef {Object} Props
	 * @property {string} [cell]
	 * @property {number} [i]
	 * @property {any} columns
	 */

	/** @type {Props} */
	let { cell = '', i = 0, columns } = $props()

	import { resolve } from '$app/paths'

	let copied = $state(false)

	const copyToClipboard = async (e) => {
		e.preventDefault()
		e.stopPropagation()
		await navigator.clipboard.writeText(cell)
		copied = true
		setTimeout(() => (copied = false), 1500)
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
			class="copy-btn"
			class:copied
			onclick={copyToClipboard}
			title="Copy index name"
		>
			<i class="{copied ? 'check' : 'copy outline'} icon"></i>
		</button>
	</span>
{:else}{cell}{/if}

<style>
	.index-cell {
		display: inline-flex;
		align-items: center;
		gap: 0.4em;
	}

	.copy-btn {
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

	.copy-btn.copied {
		opacity: 1;
		color: #21ba45;
	}

	.index-cell:hover .copy-btn {
		opacity: 0.5;
	}

	.copy-btn:hover {
		opacity: 1 !important;
	}
</style>
