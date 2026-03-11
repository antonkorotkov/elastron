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
</script>

{#if columns[i] === 'health'}
	<div class="ui center aligned">
		<i class="ui label circular empty {cell}"></i>
	</div>
{:else if columns[i] === 'index'}
	<a href={resolve(`/index/${cell}`)}>{cell}</a>
{:else}{cell}{/if}
