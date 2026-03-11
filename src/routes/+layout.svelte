<script>
	import { provideStoreon, useStoreon } from '@storeon/svelte'

	import Header from '$lib/header/Header.svelte'
	import Footer from '$lib/footer/Footer.svelte'
	import Modal from '$lib/components/modal/Modal.svelte'
	import Notifications from '$lib/components/notifications/Notifications.svelte'
	import InternetConnection from '$lib/utils/onlineCheck.js'
	import { store } from '$lib/store'
	import { isThemeToggleChecked } from '$lib/utils/helpers'

	// SvelteKit Context Provider for Storeon
	provideStoreon(store)

	const { dispatch, app } = useStoreon('app')

	let { children } = $props()

	// Client-side only logic for internet check
	import { onMount } from 'svelte'
	import { browser } from '$app/environment'

	onMount(() => {
		if (browser) {
			InternetConnection.onOnline(() => {
				dispatch('internet/online')
			})

			InternetConnection.onOffline(() => {
				dispatch('internet/offline')
			})

			if (InternetConnection.isOnline) dispatch('internet/online')

			dispatch('server/info')
		}
	})

	let inverted = $derived(isThemeToggleChecked($app.theme))
</script>

<Modal>
	<main class="ui fluid container" class:bg-black={inverted}>
		<Header />
		<div class="padded">
			{@render children()}
		</div>
		<Footer />
	</main>
</Modal>

<Notifications />

<style>
	main {
		min-height: 100%;
	}
	.bg-black {
		background: black;
	}

	.padded {
		padding-left: 1rem;
		padding-right: 1rem;
		padding-bottom: 5rem;
	}
</style>
