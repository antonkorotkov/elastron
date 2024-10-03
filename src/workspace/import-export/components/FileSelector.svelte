<script>
	export let buttonText = 'Select'
	export let selectedCallback = () => {}
	export let currentlySelected

	import { useStoreon } from '@storeon/svelte'
	import ipcRenderer from '../../../api/ipc-renderer'
	import { isThemeToggleChecked } from '../../../utils/helpers'

	const { app } = useStoreon('app')
	let selected = currentlySelected

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

	$: inverted = isThemeToggleChecked($app.theme)
</script>

<div class="file-selector">
	<div class="ui left action input">
		<button class="ui button" class:inverted on:click={onSelectClick}
			>{buttonText}</button
		>
		<input type="text" value={selected} readonly />
	</div>
</div>
