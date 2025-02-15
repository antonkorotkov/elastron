<script>
	import { useStoreon } from '@storeon/svelte'

	/**
	 * @typedef {Object} Props
	 * @property {any} direction
	 * @property {boolean} [isFileDisabled]
	 */

	/** @type {Props} */
	let { direction, isFileDisabled = false } = $props();

	const { dispatch, importExport } = useStoreon('importExport')

	const onChange = e => {
		dispatch(`ie/${direction}/reset`)
		dispatch(`ie/${direction}/type`, e.target.value)
	}
</script>

<select
	value={$importExport[direction].type}
	onchange={onChange}
	id="{direction}-select"
>
	<option value="file" disabled={isFileDisabled}>File</option>
	<option value="index">Index</option>
	<option value="remote-index">Remote Index</option>
	<option value="manual">Manual</option>
</select>
