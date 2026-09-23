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
	 * @property {boolean} [multiple] Select many items; selectedValue is then an array
	 * @property {(values: string[]) => void} [onChange] Multi-select only: the whole selection after every add, remove or clear
	 * @property {object} [floatingConfig] Positioning for the open list. Pass `{ strategy: 'fixed' }` inside a scrolling container so the list is not clipped by it.
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
		multiple = false,
		onChange = () => {},
		floatingConfig = {},
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

	const valuesOf = list =>
		(Array.isArray(list) ? list : list ? [list] : []).map(item =>
			typeof item === 'string' ? item : item?.value
		)

	/*
	 * Multi-select reports itself through two events and neither alone is the
	 * whole story. `change` carries the full selection after an item is added.
	 * `clear` carries the removed chip when one is dismissed, or the entire
	 * selection when the control's clear button is used. Both are folded back
	 * into one callback that always hands over the complete selection, so the
	 * caller stays the source of truth.
	 */
	const handleMultiChange = event => onChange(valuesOf(event?.detail))

	const handleMultiClear = event => {
		if (Array.isArray(event?.detail)) return onChange([])
		const removed = valuesOf(event?.detail)
		onChange(valuesOf(selectedValue).filter(value => !removed.includes(value)))
	}
</script>

<div class="advanced-selector" class:inverted class:multiple>
	<!--
		The single-select case remounts on every value change so the control
		reflects a value set from outside. Doing that with `multiple` would tear
		the list down after each pick and drop focus, so the key is only used
		when selecting one.
	-->
	{#if multiple}
		<Select
			label={labelIdentifier}
			clearable={isClearable}
			items={selectItems}
			value={selectedValue}
			disabled={isDisabled}
			multiple
			{placeholder}
			{inputStyles}
			{floatingConfig}
			bind:filterText
			on:change={handleMultiChange}
			on:clear={handleMultiClear}
		>
			<div slot="item" let:item>
				{item.created ? '🔧 ' : ''}{item[labelIdentifier]}
			</div>
		</Select>
	{:else}
		{#key selectedValue}
			<Select
				label={labelIdentifier}
				clearable={isClearable}
				items={selectItems}
				value={selectedValue}
				disabled={isDisabled}
				{placeholder}
				{inputStyles}
				{floatingConfig}
				bind:filterText
				on:select={onSelect}
				on:clear={onClear}
			>
				<div slot="item" let:item>
					{item.created ? '🔧 ' : ''}{item[labelIdentifier]}
				</div>
			</Select>
		{/key}
	{/if}

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

	/* With many long values the control has to grow rather than clip them, and
	   each chip keeps its whole name on one line. */
	.advanced-selector.multiple {
		--height: auto;
		--multiSelectInputPadding: 0 0 0 0.5rem;
	}
	.advanced-selector.multiple :global(.multi-item) {
		max-width: 100%;
	}
	.advanced-selector.multiple :global(.multi-item span) {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
</style>
