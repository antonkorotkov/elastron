<script>

	import { useStoreon } from '@storeon/svelte'
	import { getContext } from 'svelte'
	import { isThemeToggleChecked } from '../../../utils/helpers'
	/**
	 * @typedef {Object} Props
	 * @property {string} [filter]
	 * @property {any} [onCancel]
	 */

	/** @type {Props} */
	let { filter = '', onCancel = () => {} } = $props();

	const { app } = useStoreon('app')

	const { close } = getContext('modal-window')

	const _onCancel = () => {
		onCancel()
		close()
	}

	let inverted = $derived(isThemeToggleChecked($app.theme))
</script>

<div class="ui header">Alias Filter</div>

<div class="content">
	<pre>{filter}</pre>
</div>

<div class="actions">
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<div
		class="ui black deny button right"
		class:inverted
		onclick={_onCancel}
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
