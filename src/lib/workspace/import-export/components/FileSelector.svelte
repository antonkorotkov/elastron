<script>
	import { useStoreon } from '@storeon/svelte'
	import { isThemeToggleChecked } from '../../../utils/helpers'
	/**
	 * @typedef {Object} Props
	 * @property {string} [buttonText]
	 * @property {any} [selectedCallback]
	 * @property {any} currentlySelected
	 */

	let {
		buttonText = 'Select',
		selectedCallback = () => {},
		currentlySelected,
	} = $props()

	const { app } = useStoreon('app')

	const onSelectClick = async () => {
		try {
			const [fileHandle] = await window.showOpenFilePicker({
				types: [
					{
						description: 'JSON Files',
						accept: {
							'application/json': ['.json'],
						},
					},
				],
			})

			const file = await fileHandle.getFile()
			// selected = file.name // Removed local state assignment
			selectedCallback(file) // Pass the File object
		} catch (error) {
			// User cancelled or error
			console.debug('File selection cancelled', error)
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
