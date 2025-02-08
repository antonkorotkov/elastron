<script>
	import Select from 'svelte-select'
	import { useStoreon } from '@storeon/svelte'
	import { isThemeToggleChecked } from '../../utils/helpers'

	const { app } = useStoreon('app')

	/**
	 * @typedef {Object} Props
	 * @property {boolean} [isClearable]
	 * @property {string} [inputStyles]
	 * @property {any} [items]
	 * @property {boolean} [isCreatable]
	 * @property {any} [selectedValue]
	 * @property {boolean} [isDisabled]
	 * @property {any} [onSelect]
	 * @property {any} [onClear]
	 * @property {string} [placeholder]
	 * @property {string} [labelIdentifier]
	 */

	/** @type {Props} */
	let {
		isClearable = true,
		inputStyles = 'height:36px;background:transparent;',
		items = [],
		isCreatable = true,
		selectedValue = null,
		isDisabled = false,
		onSelect = () => {},
		onClear = () => {},
		placeholder = 'Select...',
		labelIdentifier = 'label'
	} = $props();

	let inverted = $derived(isThemeToggleChecked($app.theme))
</script>

<div class="advanced-selector" class:inverted>
	<Select
		{labelIdentifier}
		{placeholder}
		{isClearable}
		{inputStyles}
		{items}
		{isCreatable}
		value={selectedValue}
		{isDisabled}
		on:select={onSelect}
		on:clear={onClear}
	/>

	<style>
		.inverted.advanced-selector .selection {
			color: black;
		}
	</style>
</div>

<style>
	.inverted {
		--listBackground: black;
		--itemHoverBG: rgb(22, 22, 22);
	}
	.advanced-selector {
		--height: 38px;
	}
</style>
