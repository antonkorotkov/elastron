<script>
	import { setContext as baseSetContext } from 'svelte'
	import { fly, fade } from 'svelte/transition'
	import { isThemeToggleChecked } from '../../utils/helpers'
	import { useStoreon } from '@storeon/svelte'

	/**
	 * @typedef {Object} Props
	 * @property {string} [key]
	 * @property {boolean} [closeOnEsc]
	 * @property {boolean} [closeOnOuterClick]
	 * @property {any} [setContext]
	 * @property {import('svelte').Snippet} [children]
	 */

	/** @type {Props} */
	let {
		key = 'modal-window',
		closeOnEsc = true,
		closeOnOuterClick = true,
		setContext = baseSetContext,
		children
	} = $props();

	const { app } = useStoreon('app')

	const defaultState = {
		closeOnEsc,
		closeOnOuterClick,
	}

	let theState = { ...defaultState }

	let Component = $state(null)
	let theProps = $state(null)

	let background = $state()

	const open = (NewComponent, newProps = {}, options = {}) => {
		Component = NewComponent
		theProps = newProps
		theState = { ...defaultState, ...options }
	}

	const close = () => {
		Component = null
		theProps = null
	}

	const handleKeyup = event => {
		if (theState.closeOnEsc && Component && event.key === 'Escape') {
			event.preventDefault()
			close()
		}
	}

	const handleOuterClick = event => {
		if (theState.closeOnOuterClick && event.target === background) {
			event.preventDefault()
			close()
		}
	}

	setContext(key, { open, close })

	let inverted = $derived(isThemeToggleChecked($app.theme))
</script>

<svelte:window onkeyup={handleKeyup} />

{#if Component}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_interactive_supports_focus -->
	<div
		transition:fade={{ duration: 300 }}
		onclick={handleOuterClick}
		bind:this={background}
		class="ui dimmer modals page hidden flex active"
		role="alertdialog"
	>
		<div
			class="ui tiny modal hidden active"
			transition:fly={{ y: -500, duration: 300 }}
			class:inverted
		>
			<Component {...theProps} />
		</div>
	</div>

	<style>
		.modal.inverted .content,
		.modal.inverted .actions {
			background: rgb(26, 26, 26);
		}

		.modal.inverted .actions,
		.modal.inverted .header {
			border-color: rgba(255, 255, 255, 0.15);
		}

		.modal.inverted .header,
		.modal.inverted .content pre {
			background: rgb(26, 26, 26);
			color: white;
		}
	</style>
{/if}

{@render children?.()}
