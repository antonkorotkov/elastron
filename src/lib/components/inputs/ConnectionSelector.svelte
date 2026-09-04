<script>

	import { useStoreon } from '@storeon/svelte'
	import AdvancedDropdown from './AdvancedDropdown.svelte'
	/**
	 * @typedef {Object} Props
	 * @property {string} [containerStyle]
	 * @property {boolean} [allowClear]
	 * @property {boolean} [isDisabled]
	 * @property {any} currentlySelected
	 * @property {any} [onSelect]
	 * @property {any} [onClear]
	 */

	/** @type {Props} */
	let {
		containerStyle = '',
		allowClear = true,
		isDisabled = false,
		currentlySelected,
		onSelect = () => {},
		onClear = () => {}
	} = $props();

	const { connections } = useStoreon('connections')
</script>

<div class="connection-selector" style={containerStyle}>
	<AdvancedDropdown
		isClearable={allowClear}
		isCreatable={false}
		{isDisabled}
		items={$connections.connection.map((value, index) => ({
			value: index,
			label: value.name,
		}))}
		selectedValue={currentlySelected}
		{onClear}
		{onSelect}
		placeholder="Connection..."
	/>
</div>
