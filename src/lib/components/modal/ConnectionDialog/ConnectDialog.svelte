<script>
	import { useStoreon } from '@storeon/svelte'
	import { getContext } from 'svelte'

	import API, { openTunnel, closeTunnel } from '../../../api/elasticsearch'
	import {
		isThemeToggleChecked,
		contrastTextColor,
		getVersionNumber,
	} from '../../../utils/helpers'
	import { initialSshConfig } from '../../../store/connection'
	import ManageConnectionsDialog from './ManageConnectionsDialog.svelte'
	import SshTunnelFields from './SshTunnelFields.svelte'

	const { dispatch, connection, connections, app } = useStoreon(
		'connection',
		'connections',
		'app'
	)

	let { onCancel = () => {} } = $props()

	const { close, open } = getContext('modal-window')

	let inverted = $derived(isThemeToggleChecked($app.theme))
	let activeTab = $state('saved') // 'saved' or 'quick'

	// for quick connect
	let quickHost = $state('http://localhost')
	let quickPort = $state('9200')
	let quickUseAuth = $state(false)
	let quickUser = $state('')
	let quickPassword = $state('')
	let quickUseSshTunnel = $state(false)
	let quickSsh = $state({ ...initialSshConfig })

	// for saved connect
	let selectedConnectionIndex = $state(-1)

	let selectedConnection = $derived(
		selectedConnectionIndex >= 0
			? $connections?.connection?.[selectedConnectionIndex]
			: null
	)
	let selectedColor = $derived(selectedConnection?.color || '')
	let selectedName = $derived(selectedConnection?.name || '')

	let loading = $state(false)

	$effect(() => {
		if (
			selectedConnectionIndex === -1 &&
			$connections &&
			$connections.connection &&
			$connection
		) {
			const idx = $connections.connection.findIndex(
				c => c.name === $connection.name && c.host === $connection.host
			)
			if (idx >= 0) {
				selectedConnectionIndex = idx
			}
		}
	})

	const _onCancel = () => {
		onCancel()
		close()
	}

	const openManageConnections = () => {
		close()
		open(
			ManageConnectionsDialog,
			{},
			{
				closeOnEsc: false,
				closeOnOuterClick: false,
			}
		)
	}

	const openNewWindow = () => {
		if (selectedConnectionIndex < 0) {
			dispatch('notification/add', {
				type: 'error',
				message: 'Please select a connection',
			})
			return
		}
		if (window.electron && window.electron.ipcRenderer) {
			window.electron.ipcRenderer.send(
				'window:new',
				`?connectionIndex=${selectedConnectionIndex}`
			)
			close()
		} else {
			dispatch('notification/add', {
				type: 'error',
				message: 'IPC Error',
			})
		}
	}

	const connectSaved = async () => {
		if (selectedConnectionIndex < 0) {
			dispatch('notification/add', {
				type: 'error',
				message: 'Please select a connection',
			})
			return
		}
		loading = true
		const conn = $connections.connection[selectedConnectionIndex]
		dispatch('connection/update', $state.snapshot(conn))
		dispatch('connection/save', () => {
			loading = false
			close()
		}) // This does test, connect, history, and closes
	}

	const connectQuick = async () => {
		const quickConn = {
			name: '',
			host: quickHost,
			port: quickPort,
			useAuth: quickUseAuth,
			user: quickUser,
			password: quickPassword,
			addHeaders: false,
			headers: [],
			useSshTunnel: quickUseSshTunnel,
			ssh: $state.snapshot(quickSsh),
			// Explicit, because connection/update merges over the previous
			// connection — without it an ad-hoc localhost session would inherit
			// the color of whichever cluster was connected before it.
			color: '',
		}

		loading = true
		dispatch('connection/update', $state.snapshot(quickConn))

		try {
			const windowId = $app.windowId

			// Clean up any existing tunnel from a previous connection
			await closeTunnel(windowId).catch(() => {})

			// Open SSH tunnel if configured
			if (quickUseSshTunnel) {
				const tunnelResult = await openTunnel($state.snapshot(quickConn), windowId)
				if (tunnelResult.error) {
					dispatch('notification/add', {
						type: 'error',
						message: `SSH Tunnel: ${tunnelResult.error}`,
					})
					loading = false
					return
				}
			}

			const api = new API($state.snapshot(quickConn), windowId)
			const test = await api.test()
			if (test.success) {
				dispatch('connected', {
					version: getVersionNumber(test.version),
					flavor: test.version?.build_flavor,
				})
				dispatch('server/update', { version: test.version })
				close()
			} else {
				dispatch('disconnected')
				dispatch('notification/add', {
					type: 'error',
					message: 'Connection failed',
				})
			}
		} catch (error) {
			console.error(error.message)
			dispatch('disconnected')
			dispatch('notification/add', { type: 'error', message: error.message })
		} finally {
			loading = false
		}
	}
</script>

<div class="ui header">Connect to Elasticsearch</div>

<div class="content">
	<div class="ui pointing secondary menu" class:inverted>
		<button
			class="item"
			class:active={activeTab === 'saved'}
			onclick={() => (activeTab = 'saved')}
		>
			Saved Connections
		</button>
		<button
			class="item"
			class:active={activeTab === 'quick'}
			onclick={() => (activeTab = 'quick')}
		>
			Quick Connect
		</button>
	</div>

	{#if activeTab === 'saved'}
		<div
			class="ui form"
			class:inverted
			style="min-height: 150px; padding-top: 1rem;"
		>
			<div class="field">
				<div class="connection-choice">
					<select
						id="saved-connection"
						class="ui dropdown"
						bind:value={selectedConnectionIndex}
					>
						<option value={-1}>-- Select --</option>
						{#if $connections && $connections.connection}
							{#each $connections.connection as conn, i (i)}
								<option value={i}
									>{conn.name ||
										conn.host + (conn.port ? ':' + conn.port : '')}</option
								>
							{/each}
						{/if}
					</select>
					<!--
						The color sits beside the select rather than on the options:
						per-option backgrounds are honoured by Chromium's own listbox on
						Windows and Linux, but ignored by the OS-drawn popup on macOS.
					-->
					{#if selectedColor}
						<span
							class="connection-chip"
							style="background: {selectedColor}; color: {contrastTextColor(
								selectedColor
							)};">{selectedName}</span
						>
					{/if}
				</div>
			</div>
			{#if !$connections || !$connections.connection || $connections.connection.length === 0}
				<div class="ui message" class:inverted>
					No saved connections. Go to Manage Connections to add one.
				</div>
			{/if}
		</div>
	{:else}
		<form
			class="ui form"
			class:inverted
			style="min-height: 150px; padding-top: 1rem;"
			onsubmit={e => {
				e.preventDefault()
				connectQuick()
			}}
			id="quick-form"
		>
			<div class="fields">
				<div class="twelve wide field">
					<label for="quick-host">Host</label>
					<input type="url" id="quick-host" required bind:value={quickHost} />
				</div>
				<div class="four wide field">
					<label for="quick-port">Port</label>
					<input type="number" id="quick-port" bind:value={quickPort} />
				</div>
			</div>
			<div class="field">
				<div class="ui checkbox">
					<input id="quick-auth" type="checkbox" bind:checked={quickUseAuth} />
					<label for="quick-auth">Basic Auth</label>
				</div>
			</div>
			{#if quickUseAuth}
				<div class="fields">
					<div class="eight wide field">
						<label for="quick-user">User</label>
						<input
							required
							type="text"
							id="quick-user"
							bind:value={quickUser}
						/>
					</div>
					<div class="eight wide field">
						<label for="quick-password">Password</label>
						<input
							required
							type="password"
							id="quick-password"
							bind:value={quickPassword}
						/>
					</div>
				</div>
			{/if}
			<SshTunnelFields
				bind:useSshTunnel={quickUseSshTunnel}
				bind:ssh={quickSsh}
				{inverted}
			/>
		</form>
	{/if}
</div>

<div class="actions">
	<button class="ui black deny button right" class:inverted onclick={_onCancel}>
		Cancel
	</button>
	<button
		class="ui button left floated"
		class:inverted
		onclick={openManageConnections}
	>
		Manage Connections
	</button>
	{#if activeTab === 'saved'}
		<button
			class="ui button right"
			class:inverted
			class:disabled={loading || selectedConnectionIndex < 0}
			onclick={openNewWindow}
		>
			<i class="external alternate icon"></i>
			Open in New Window
		</button>
		<button
			class="ui green right button"
			class:inverted
			class:loading
			class:disabled={loading || selectedConnectionIndex < 0}
			onclick={connectSaved}
		>
			Connect
		</button>
	{:else}
		<button
			type="submit"
			class="ui green right button"
			class:inverted
			class:loading
			class:disabled={loading}
			form="quick-form"
		>
			Connect
		</button>
	{/if}
</div>

<style>
	.ui.menu.secondary {
		margin-top: 0;
		margin-bottom: 0;
	}
	.left.floated {
		float: left;
	}
	.connection-choice {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}
	.connection-choice select {
		flex: 1;
		min-width: 0;
	}
	.connection-chip {
		flex: none;
		max-width: 40%;
		padding: 0.4rem 0.75rem;
		border-radius: 4px;
		font-weight: 700;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	/* Simple reset for buttons acting as tabs to not look like buttons */
	button.item {
		background: transparent;
		border: none;
		cursor: pointer;
		padding-bottom: 0.85714286em;
		margin-bottom: -2px;
	}
</style>
