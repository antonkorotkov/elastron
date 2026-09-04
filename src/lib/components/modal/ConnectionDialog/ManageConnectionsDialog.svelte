<script>
	import { useStoreon } from '@storeon/svelte'
	import { getContext } from 'svelte'

	import API, { openTunnel, closeTunnel } from '../../../api/elasticsearch'
	import { isThemeToggleChecked } from '../../../utils/helpers'
	import { setStorage } from '../../../utils/storage'
	import { initialSshConfig } from '../../../store/connection'
	import Headers from './Headers.svelte'
	import SshTunnelFields from './SshTunnelFields.svelte'
	import ColorPicker from '../../inputs/ColorPicker.svelte'

	const { dispatch, connections, app, connection } = useStoreon(
		'connections',
		'app',
		'connection'
	)

	let { onCancel = () => {} } = $props()

	const { close, open } = getContext('modal-window')

	let inverted = $derived(isThemeToggleChecked($app.theme))

	// We maintain a local editing copy to avoid modifying the store directly until "Save"
	let localConnection = $state(null)
	let selectedIndex = $state(-1) // -1 means no selection
	let isEditingNew = $state(false)

	// Init with the first connection if available
	$effect(() => {
		if (
			selectedIndex === -1 &&
			$connections.connection.length > 0 &&
			!isEditingNew
		) {
			selectConnection(0)
		} else if ($connections.connection.length === 0 && !isEditingNew) {
			addNewConnection()
		}
	})

	const selectConnection = index => {
		selectedIndex = index
		isEditingNew = false
		if (index >= 0) {
			// `color` is defaulted here as well as in the store, because a
			// connection reaching the form without it would break `bind:value`
			// on the color picker.
			localConnection = {
				color: '',
				...JSON.parse(JSON.stringify($connections.connection[index])),
			}
		} else {
			localConnection = null
		}
	}

	const addNewConnection = () => {
		localConnection = {
			name: 'New Connection',
			host: 'http://localhost',
			port: '9200',
			useAuth: false,
			user: '',
			password: '',
			addHeaders: false,
			headers: [{ name: '', value: '' }],
			useSshTunnel: false,
			ssh: { ...initialSshConfig },
			color: '',
		}
		selectedIndex = -1
		isEditingNew = true
	}

	const _onCancel = async () => {
		onCancel()
		close()
		const ConnectDialog = (await import('./ConnectDialog.svelte')).default
		open(ConnectDialog, {}, { closeOnEsc: false, closeOnOuterClick: false })
	}

	const deleteConnection = () => {
		try {
			if (selectedIndex >= 0) {
				const target = $connections.connection[selectedIndex]
				const targetLabel =
					target.name || target.host + (target.port ? ':' + target.port : '')
				if (!confirm(`Delete the connection "${targetLabel}"?`)) return

				dispatch('connections/delete', target)
				if ($connections.connection.length > 0) {
					selectConnection(Math.max(0, selectedIndex - 1))
				} else {
					addNewConnection()
				}
			} else if (isEditingNew) {
				// just cancel editing new
				if ($connections.connection.length > 0) {
					selectConnection(0)
				}
			}
		} catch (e) {
			dispatch('notification/add', {
				type: 'error',
				message: e.message,
			})
		}
	}

	const testConnection = async () => {
		const testWindowId = $app.windowId
			? $app.windowId + '_test'
			: crypto.randomUUID()
		try {
			if (localConnection.useSshTunnel) {
				const tunnelResult = await openTunnel(
					$state.snapshot(localConnection),
					testWindowId
				)
				if (tunnelResult.error) {
					dispatch('notification/add', {
						type: 'error',
						message: `SSH Tunnel: ${tunnelResult.error}`,
					})
					return
				}
			}

			const api = new API($state.snapshot(localConnection), testWindowId)
			const { success, message } = await api.test()

			dispatch('notification/add', {
				type: success ? 'success' : 'error',
				message,
			})
		} catch (e) {
			dispatch('notification/add', {
				type: 'error',
				message: e.message,
			})
		} finally {
			if (localConnection.useSshTunnel) {
				closeTunnel(testWindowId).catch(() => {})
			}
		}
	}

	/**
	 * Relabelling the connection you are currently on should repaint the header
	 * straight away, without making you reconnect.
	 *
	 * Only `name` and `color` are pushed across — the two fields that describe
	 * the connection rather than address it. Sending the whole edited connection
	 * would swap the host or credentials of a live session without reconnecting,
	 * leaving the header advertising a cluster the app is not talking to, which
	 * is the exact mistake this feature exists to prevent. They travel together
	 * because syncing one without the other is its own kind of lie: a red badge
	 * still carrying the old name is worse than one that has not changed at all.
	 *
	 * `lastConnection` has to be rewritten too: the layout prefers it over the
	 * saved list when hydrating, so without this the change would revert on the
	 * next launch.
	 *
	 * @param {object} previous the saved entry as it was before this save
	 */
	const syncLabelToActiveConnection = previous => {
		// Port is part of the match: two entries can share a name and host and
		// still be different clusters, and relabelling one must not repaint the
		// header for the other.
		const isActive =
			previous.name === $connection.name &&
			previous.host === $connection.host &&
			previous.port === $connection.port

		const { name, color } = localConnection
		const unchanged = previous.name === name && previous.color === color

		if (!isActive || unchanged) return

		dispatch('connection/update', { name, color })
		setStorage('lastConnection', {
			...$state.snapshot($connection),
			name,
			color,
		})
	}

	const save = e => {
		if (e) e.preventDefault()

		if (!localConnection.useAuth) {
			localConnection.user = ''
			localConnection.password = ''
		}

		if (selectedIndex >= 0) {
			// Compare against the entry as it was before this save, so a rename
			// alongside a recolor still recognizes the live connection.
			const previous = $connections.connection[selectedIndex]

			// Replace in place, so editing never reorders the list
			dispatch('connections/replace', {
				index: selectedIndex,
				connection: $state.snapshot(localConnection),
			})

			syncLabelToActiveConnection(previous)
		} else {
			dispatch('connections/add', $state.snapshot(localConnection))
			setTimeout(() => selectConnection($connections.connection.length - 1), 0)
		}

		dispatch('notification/add', {
			type: 'success',
			message: 'Connection saved',
		})
		isEditingNew = false
	}

	const saveAndConnect = async e => {
		save(e)
		// Now connect
		dispatch('connection/update', $state.snapshot(localConnection))
		dispatch('connection/save', () => {
			close() // we don't open ConnectDialog if we connect successfully
		})
	}

	const onHeaderAdd = () => {
		localConnection.headers = [
			...localConnection.headers,
			{ name: '', value: '' },
		]
	}

	const onHeaderDelete = index => {
		let headers = [...localConnection.headers]
		headers.splice(index, 1)
		localConnection.headers = headers
	}

	const onHeaderChange = (data, value) => {
		const { index, field } = data
		let headers = [...localConnection.headers]
		headers[index][field] = value
		localConnection.headers = headers
	}
</script>

<div class="ui header">Manage Connections</div>

<div
	class="scrolling content"
	style="display: flex; gap: 1rem; min-height: 400px; padding:0;"
>
	<!-- Sidebar -->
	<div
		class="ui vertical menu"
		class:inverted
		style="width: 250px; margin: 0; border-radius: 0; border-top: none; border-bottom: none; border-left: none; max-height: 440px; overflow-y: auto;"
	>
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_interactive_supports_focus -->
		<div
			class="item"
			role="button"
			onclick={addNewConnection}
			style="cursor: pointer; color: #21ba45; font-weight: bold;"
		>
			<i class="plus icon"></i> Add New
		</div>
		{#if $connections && $connections.connection}
			{#each $connections.connection as conn, i (i)}
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<!-- svelte-ignore a11y_interactive_supports_focus -->
				<div
					class="item"
					class:active={selectedIndex === i && !isEditingNew}
					role="button"
					onclick={() => selectConnection(i)}
					style="cursor: pointer;"
				>
					{#if conn.color}
						<span
							class="connection-dot"
							style="background: {conn.color};"
							aria-hidden="true"
						></span>
					{/if}
					{conn.name || conn.host + (conn.port ? ':' + conn.port : '')}
				</div>
			{/each}
		{/if}
		{#if isEditingNew}
			<div class="item active" style="font-style: italic;">
				New Connection...
			</div>
		{/if}
	</div>

	<!-- Right Pane -->
	<div style="flex: 1; padding: 1rem;">
		{#if localConnection}
			<form
				class="ui form"
				class:inverted
				onsubmit={saveAndConnect}
				id="manage-connection-form"
			>
				<div class="fields">
					<div class="sixteen wide field">
						<label for="name">Name</label>
						<input
							type="text"
							id="name"
							required={true}
							bind:value={localConnection.name}
							maxlength="32"
						/>
					</div>
				</div>
				<div class="fields">
					<div class="sixteen wide field">
						<!-- svelte-ignore a11y_label_has_associated_control -->
						<label>Color</label>
						<ColorPicker bind:value={localConnection.color} {inverted} />
					</div>
				</div>
				<div class="fields">
					<div class="twelve wide field">
						<label for="host">Host</label>
						<input
							type="url"
							id="host"
							required={true}
							bind:value={localConnection.host}
						/>
					</div>
					<div class="four wide field">
						<label for="port">Port</label>
						<input type="number" id="port" bind:value={localConnection.port} />
					</div>
				</div>
				<div class="field">
					<div class="ui checkbox">
						<input
							id="auth"
							type="checkbox"
							bind:checked={localConnection.useAuth}
						/>
						<label for="auth">Basic Auth</label>
					</div>
				</div>
				{#if localConnection.useAuth}
					<div class="fields">
						<div class="eight wide field">
							<label for="user">User</label>
							<input
								required={localConnection.useAuth}
								type="text"
								id="user"
								bind:value={localConnection.user}
							/>
						</div>
						<div class="eight wide field">
							<label for="password">Password</label>
							<input
								required={localConnection.useAuth}
								type="password"
								id="password"
								bind:value={localConnection.password}
							/>
						</div>
					</div>
				{/if}
				<SshTunnelFields
					bind:useSshTunnel={localConnection.useSshTunnel}
					bind:ssh={localConnection.ssh}
					{inverted}
				/>
				<div class="field">
					<div class="ui checkbox">
						<input
							id="headers"
							type="checkbox"
							bind:checked={localConnection.addHeaders}
						/>
						<label for="headers">Add Headers</label>
					</div>
				</div>
				{#if localConnection.addHeaders}
					<Headers
						headers={localConnection.headers}
						onAdd={onHeaderAdd}
						onChange={onHeaderChange}
						onDelete={onHeaderDelete}
					/>
				{/if}
			</form>
		{:else}
			<div class="ui placeholder segment" class:inverted>
				<div class="ui icon header">
					<i class="plug icon"></i>
					Select or create a connection
				</div>
			</div>
		{/if}
	</div>
</div>

<div class="actions">
	<button class="ui black deny button right" class:inverted onclick={_onCancel}>
		Back to Connect
	</button>
	{#if localConnection}
		<button
			class="ui red button left floated"
			class:inverted
			onclick={deleteConnection}
		>
			Delete
		</button>
		<button class="ui button" class:inverted onclick={testConnection}>
			Test
		</button>
		<button
			type="button"
			class="ui blue button"
			class:inverted
			onclick={e => save(e)}
		>
			Save
		</button>
		<button
			type="submit"
			class="ui green right button"
			class:inverted
			form="manage-connection-form"
		>
			Save & Connect
		</button>
	{/if}
</div>

<style>
	.left.floated {
		float: left;
	}

	.connection-dot {
		display: inline-block;
		width: 10px;
		height: 10px;
		margin-right: 0.5rem;
		border-radius: 50%;
		vertical-align: baseline;
	}
</style>
