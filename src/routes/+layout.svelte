<script>
	import { provideStoreon, useStoreon } from '@storeon/svelte'
	import { afterNavigate } from '$app/navigation'
	import { PUBLIC_GA_ID } from '$env/static/public'

	import Header from '$lib/header/Header.svelte'
	import Footer from '$lib/footer/Footer.svelte'
	import Modal from '$lib/components/modal/Modal.svelte'
	import Notifications from '$lib/components/notifications/Notifications.svelte'
	import InternetConnection from '$lib/utils/onlineCheck.js'
	import { store } from '$lib/store'
	import { isThemeToggleChecked } from '$lib/utils/helpers'

	// SvelteKit Context Provider for Storeon
	provideStoreon(store)

	const { dispatch, app, connection } = useStoreon('app', 'connection')

	let { children } = $props()

	// The document title labels the window in the Window menu / taskbar
	let windowTitle = $derived(
		$connection?.name ||
			($connection?.host
				? $connection.host + ($connection.port ? ':' + $connection.port : '')
				: 'Elastron')
	)

	// Client-side only logic for internet check
	import { onMount } from 'svelte'
	import { browser } from '$app/environment'
	import { getStorage } from '$lib/utils/storage.js'
	import { initialConnection } from '$lib/store/connection.js'
	import { flushPlaygroundDraft } from '$lib/store/playground.js'

	onMount(async () => {
		if (browser) {
			const windowId = crypto.randomUUID();
			window.__elastronWindowId = windowId;
			dispatch('app/hydrate', { windowId });

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

			// Hydrated before `connection/save` so a persisted draft exists before
			// the `connected` event it triggers can reset the draft's index/response.
			const playgroundTemplates = await getStorage('playground_templates', [])
			const playgroundDraft = await getStorage('playground_draft', null)
			dispatch('playground/hydrate', { templates: playgroundTemplates, draft: playgroundDraft })

			dispatch('connection/save')
			dispatch('connections/hydrate', { connection: connections })

			const lastSearch = await getStorage('lastSearch', null)
			if (lastSearch) {
				dispatch('search/hydrate', lastSearch)
			}

			const tableConfigs = await getStorage('tableConfigs', {})
			dispatch('search/tableConfigs/hydrate', tableConfigs)

			const theme = await getStorage('theme')
			dispatch('app/hydrate', { theme: theme ?? 'light' })
			dispatch('server/info')

			// Clean up SSH tunnel on window close
			window.addEventListener('beforeunload', () => {
				flushPlaygroundDraft()

				const state = store.get()
				if (state.connection?.useSshTunnel && state.app?.windowId) {
					fetch('/api/elastic/tunnel/close', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ windowId: state.app.windowId }),
						keepalive: true
					}).catch(() => {})
				}
			})
		}
	})

	afterNavigate(({ to }) => {
		if (PUBLIC_GA_ID && typeof gtag !== 'undefined' && to) {
			gtag('config', PUBLIC_GA_ID, {
				page_path: to.url.pathname
			})
		}
	})

	let inverted = $derived(isThemeToggleChecked($app.theme))
</script>

<svelte:head>
	<title>{windowTitle}</title>
	{#if PUBLIC_GA_ID}
		<script async src="https://www.googletagmanager.com/gtag/js?id={PUBLIC_GA_ID}"></script>
		<script>
			window.dataLayer = window.dataLayer || [];
			function gtag() {
				dataLayer.push(arguments);
			}
			gtag('js', new Date());
			gtag('config', '{PUBLIC_GA_ID}', {
				page_path: window.location.pathname
			});
		</script>
	{/if}
</svelte:head>

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
