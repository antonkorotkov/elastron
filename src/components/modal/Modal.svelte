<!-- @migration-task Error while migrating Svelte code: can't migrate `let Component = null` to `$state` because there's a variable named state.
     Rename the variable and try again or migrate by hand. -->
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

	let state = { ...defaultState }

	let Component = null
	let props = null

	let background

	const open = (NewComponent, newProps = {}, options = {}) => {
		Component = NewComponent
		props = newProps
		state = { ...defaultState, ...options }
	}

	const close = () => {
		Component = null
		props = null
	}

	const handleKeyup = ({ key }) => {
		if (state.closeOnEsc && Component && key === 'Escape') {
			event.preventDefault()
			close()
		}
	}

	const handleOuterClick = event => {
		if (state.closeOnOuterClick && event.target === background) {
			event.preventDefault()
			close()
		}
	}

	setContext(key, { open, close })

	$: inverted = isThemeToggleChecked($app.theme)
</script>

<svelte:window on:keyup={handleKeyup} />

{#if Component}
	<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-noninteractive-element-interactions -->
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
			<svelte:component this={Component} {...props} />
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
