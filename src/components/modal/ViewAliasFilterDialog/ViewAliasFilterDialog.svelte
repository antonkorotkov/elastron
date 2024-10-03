<script>
	export let filter = ''
	export let onCancel = () => {}

	import { useStoreon } from '@storeon/svelte'
	import { getContext } from 'svelte'
	import { isThemeToggleChecked } from '../../../utils/helpers'

	const { app } = useStoreon('app')

	const { close } = getContext('modal-window')

	const _onCancel = () => {
		onCancel()
		close()
	}

	$: inverted = isThemeToggleChecked($app.theme)
</script>

<div class="ui header">Alias Filter</div>

<div class="content">
	<pre>{filter}</pre>
</div>

<div class="actions">
	<!-- svelte-ignore a11y-click-events-have-key-events -->
	<div
		class="ui black deny button right"
		class:inverted
		on:click={_onCancel}
		role="button"
		tabindex="0"
	>
		Close
	</div>
</div>

<style>
	pre {
		margin: 0;
	}
</style>
