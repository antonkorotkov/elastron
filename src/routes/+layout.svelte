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
	import { getStorage } from '$lib/utils/storage.js'
	import { initialConnection } from '$lib/store/connection.js'

	onMount(async () => {
		if (browser) {
			InternetConnection.onOnline(() => {
				dispatch('internet/online')
			})

			InternetConnection.onOffline(() => {
				dispatch('internet/offline')
			})

			if (InternetConnection.isOnline) dispatch('internet/online')

			const connections = await getStorage('connection', [])

			const urlParams = new URLSearchParams(window.location.search)
			let urlConnection = null
			if (urlParams.has('connectionIndex')) {
				const idx = parseInt(urlParams.get('connectionIndex'), 10)
				if (!isNaN(idx) && idx >= 0 && idx < connections.length) {
					urlConnection = connections[idx]
				}
			}

			const lastConnection = await getStorage('lastConnection', null)
			const currentConnection =
				urlConnection ??
				lastConnection ??
				connections[connections.length - 1] ??
				initialConnection

			dispatch('connection/hydrate', currentConnection)
			dispatch('connection/save')
			dispatch('history/hydrate', { connection: connections })

			const lastSearch = await getStorage('lastSearch', null)
			if (lastSearch) {
				dispatch('search/hydrate', lastSearch)
			}

			const theme = await getStorage('theme')
			dispatch('app/hydrate', { theme: theme ?? 'light' })
			dispatch('server/info')

			const playgroundTemplates = await getStorage('playground_templates', [])
			dispatch('playground/hydrate', playgroundTemplates)
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
		padding-bottom: 4rem;
	}
</style>
