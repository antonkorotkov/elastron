<script>
	export let containerStyle = ''
	export let allowCustom = false
	export let allowClear = true
	export let isDisabled = false
	export let currentlySelected
	export let onSelect = () => {}
	export let onClear = () => {}
	export let placeholder = 'Select Index...'

	import { useStoreon } from '@storeon/svelte'
	import { getIndexListFromIndexData } from '../../utils/helpers'
	import AdvancedDropdown from './AdvancedDropdown.svelte'

	const { indices } = useStoreon('indices')

	$: items = getIndexListFromIndexData($indices)
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
