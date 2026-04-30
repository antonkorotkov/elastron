<script>

	import { useStoreon } from '@storeon/svelte'
	import { getIndexListFromIndexData } from '../../utils/helpers'
	import AdvancedDropdown from './AdvancedDropdown.svelte'

	/**
	 * @typedef {Object} Props
	 * @property {string} [containerStyle]
	 * @property {boolean} [allowCustom]
	 * @property {boolean} [allowClear]
	 * @property {boolean} [isDisabled]
	 * @property {any} currentlySelected
	 * @property {any} [onSelect]
	 * @property {any} [onClear]
	 * @property {string} [placeholder]
	 */

	/** @type {Props} */
	let {
		containerStyle = '',
		allowCustom = false,
		allowClear = true,
		isDisabled = false,
		currentlySelected,
		onSelect = () => {},
		onClear = () => {},
		placeholder = 'Select Index...'
	} = $props();

	const { indices } = useStoreon('indices')

	let items = $derived(getIndexListFromIndexData($indices))
</script>

<div class="index-selector" style={containerStyle}>
	<AdvancedDropdown
		isClearable={allowClear}
		isCreatable={allowCustom}
		{isDisabled}
		{items}
		selectedValue={currentlySelected}
		{onClear}
		{onSelect}
		{placeholder}
	/>
</div>
