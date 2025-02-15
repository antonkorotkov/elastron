<script>

	import { useStoreon } from '@storeon/svelte'
	import ipcRenderer from '../../../api/ipc-renderer'
	import { isThemeToggleChecked } from '../../../utils/helpers'
	/**
	 * @typedef {Object} Props
	 * @property {string} [buttonText]
	 * @property {any} [selectedCallback]
	 * @property {any} currentlySelected
	 */

	/** @type {Props} */
	let { buttonText = 'Select', selectedCallback = () => {}, currentlySelected } = $props();

	const { app } = useStoreon('app')
	let selected = $state(currentlySelected)

	const onSelectClick = () => {
		ipcRenderer
			.run('select-file', { extensions: ['json'] })
			.then(result => {
				const { canceled, filePaths } = result

				if (!canceled) {
					selected = filePaths[0]
				}

				return result
			})
			.then(selectedCallback)
	}

	let inverted = $derived(isThemeToggleChecked($app.theme))
</script>

<div class="file-selector">
	<div class="ui left action input">
		<button class="ui button" class:inverted onclick={onSelectClick}
			>{buttonText}</button
		>
		<input type="text" value={selected} readonly />
	</div>
</div>
