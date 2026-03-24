<script>
	import { setContext as baseSetContext, untrack } from 'svelte'
	import { fly, fade } from 'svelte/transition'
	import { isThemeToggleChecked } from '../../utils/helpers'
	import { useStoreon } from '@storeon/svelte'

	let {
		key = 'modal-window',
		closeOnEsc = true,
		closeOnOuterClick = true,
		setContext = baseSetContext,
		children,
	} = $props()

	const { app } = useStoreon('app')

	const getDefaultState = () => ({
		closeOnEsc,
		closeOnOuterClick,
	})

	let theState = $state(getDefaultState())
	let inverted = $derived(isThemeToggleChecked($app.theme))

	let Component = $state(null)
	let theProps = $state(null)
	let background = $state()

	const open = (NewComponent, newProps = {}, options = {}) => {
		Component = NewComponent
		theProps = newProps
		theState = { ...getDefaultState(), ...options }
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

	untrack(() => {
		setContext(key, { open, close })
	})
</script>

<svelte:window onkeyup={handleKeyup} />

{#if Component}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<div
		transition:fade={{ duration: 300 }}
		onclick={handleOuterClick}
		bind:this={background}
		class="ui dimmer modals page hidden flex active"
		role="alertdialog"
		tabindex="-1"
	>
		<div
			class="ui small modal hidden active"
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

{@render children()}
