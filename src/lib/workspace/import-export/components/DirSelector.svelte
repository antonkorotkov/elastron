<script>
	import { useStoreon } from '@storeon/svelte'
	import { isThemeToggleChecked } from '../../../utils/helpers'
	/**
	 * @typedef {Object} Props
	 * @property {string} [buttonText]
	 * @property {any} [selectedCallback]
	 * @property {any} currentlySelected
	 */

	/** @type {Props} */
	let {
		buttonText = 'Select',
		selectedCallback = () => {},
		currentlySelected,
	} = $props()

	const { app } = useStoreon('app')

	const onSelectClick = async () => {
		try {
			// For Export, we usually want to save a file, not just pick a dir
			// If the original intended to pick a directory to save 'export.json' into:
			// showSaveFilePicker encompasses both naming and location.
			const handle = await window.showSaveFilePicker({
				types: [
					{
						description: 'JSON File',
						accept: { 'application/json': ['.json'] },
					},
				],
				suggestedName: 'export.json',
			})

			// selected = handle.name // Removed local state assignment
			selectedCallback(handle) // Pass handle
		} catch (error) {
			console.debug('Save selection cancelled', error)
		}
	}

	let inverted = $derived(isThemeToggleChecked($app.theme))
</script>

<div class="file-selector">
	<div class="ui left action input">
		<button class="ui button" class:inverted onclick={onSelectClick}
			>{buttonText}</button
		>
		<input type="text" value={currentlySelected} readonly />
	</div>
</div>
