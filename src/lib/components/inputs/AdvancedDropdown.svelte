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
		inputStyles = 'height:36px;background:transparent;border:none;',
		items = [],
		isCreatable = true,
		selectedValue = null,
		isDisabled = false,
		onSelect = () => {},
		onClear = () => {},
		placeholder = 'Select...',
		labelIdentifier = 'label',
	} = $props()

	let inverted = $derived(isThemeToggleChecked($app.theme))
	let filterText = $state('')
	let normalizedItems = $derived(
		(items || []).map(item => (typeof item === 'object' ? item : { value: item, [labelIdentifier]: item }))
	)

	let createdItem = $derived.by(() => {
		if (!isCreatable || filterText.trim().length === 0) return null
		if (normalizedItems.some(item => item[labelIdentifier] === filterText)) return null

		return { value: filterText, [labelIdentifier]: filterText, created: true }
	})

	let selectItems = $derived(createdItem ? [...normalizedItems, createdItem] : normalizedItems)
</script>

<div class="advanced-selector" class:inverted>
	{#key selectedValue}
		<Select
			label={labelIdentifier}
			clearable={isClearable}
			items={selectItems}
			value={selectedValue}
			disabled={isDisabled}
			{placeholder}
			{inputStyles}
			bind:filterText
			on:select={onSelect}
			on:clear={onClear}
		>
			<div slot="item" let:item>
				{item.created ? '🔧 ' : ''}{item[labelIdentifier]}
			</div>
		</Select>
	{/key}

	<style>
		.inverted.advanced-selector .svelte-select {
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
