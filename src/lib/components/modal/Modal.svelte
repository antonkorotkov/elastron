<script>
	import { setContext as baseSetContext } from 'svelte'
	import { fly, fade } from 'svelte/transition'
	import { isThemeToggleChecked } from '../../utils/helpers'
	import { useStoreon } from '@storeon/svelte'

	export let key = 'modal-window'
	export let closeOnEsc = true
	export let closeOnOuterClick = true
	export let setContext = baseSetContext

	const { app } = useStoreon('app')

	const defaultState = {
		closeOnEsc,
		closeOnOuterClick,
	}

	let theState = { ...defaultState }

	let Component = null
	let theProps = null

	let background

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

	$: inverted = isThemeToggleChecked($app.theme)
</script>

<svelte:window on:keyup={handleKeyup} />

{#if Component}
	<!-- svelte-ignore a11y-click-events-have-key-events -->
	<!-- svelte-ignore a11y-interactive-supports-focus -->
	<div
		transition:fade={{ duration: 300 }}
		on:click={handleOuterClick}
		bind:this={background}
		class="ui dimmer modals page hidden flex active"
		role="alertdialog"
	>
		<div
			class="ui tiny modal hidden active"
			transition:fly={{ y: -500, duration: 300 }}
			class:inverted
		>
			<svelte:component this={Component} {...theProps} />
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

<slot />
