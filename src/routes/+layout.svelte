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
	// In strict SSR, store should be created per-request, but for a Desktop app (single user per process),
	// a global store is acceptable, provided we handle hydration carefully.
	// However, clean SSR usually demands `store` to be passed via context or props.
	// Since we reuse existing code which expects `provideStoreon(store)`, we do it here.
	provideStoreon(store)

	const { dispatch, app } = useStoreon('app')

	// Client-side only logic for internet check
	import { onMount } from 'svelte'

	// We need to run these only in browser
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

	$: inverted = isThemeToggleChecked($app.theme)
</script>

<Modal>
	<main class="ui fluid container" class:bg-black={inverted}>
		<Header />
		<slot />
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
</style>
