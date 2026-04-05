<script>
	/**
	 * @typedef {Object} Props
	 * @property {any} onClick
	 * @property {any} className
	 * @property {boolean} [loading]
	 * @property {string} [title]
	 */

	import { isThemeToggleChecked } from '../../utils/helpers'
	import { useStoreon } from '@storeon/svelte'

	const { app } = useStoreon('app')

	/** @type {Props} */
	let { onClick, className, loading = false, title = '' } = $props()

	const classToggle = (e, className) => {
		e.target.classList.toggle(className)
	}

	let inverted = $derived(isThemeToggleChecked($app.theme))
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<i
	class="icon {className}"
	class:loading
	class:inverted
	{title}
	onmouseover={e => classToggle(e, 'green')}
	onfocus={e => classToggle(e, 'green')}
	onmouseout={e => classToggle(e, 'green')}
	onblur={e => classToggle(e, 'green')}
	onclick={onClick}
	role="button"
	tabindex="0"
></i>

<style>
	.icon {
		cursor: pointer;
	}
</style>
