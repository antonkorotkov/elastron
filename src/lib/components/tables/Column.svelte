<script>
	/**
	 * @typedef {Object} Props
	 * @property {string} [column]
	 */

	/** @type {Props} */
	let { column = '' } = $props();
</script>

{column.toUpperCase()}
