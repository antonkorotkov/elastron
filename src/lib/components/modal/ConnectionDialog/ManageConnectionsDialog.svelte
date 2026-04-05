<script>
	import { useStoreon } from '@storeon/svelte'
	import { getContext } from 'svelte'

	import API, { openTunnel } from '../../../api/elasticsearch'
	import { isThemeToggleChecked } from '../../../utils/helpers'
	import { initialSshConfig } from '../../../store/connection'
	import Headers from './Headers.svelte'
	import SshTunnelFields from './SshTunnelFields.svelte'

	const { dispatch, history, app } = useStoreon(
		'history',
		'app'
	)

	let { onCancel = () => {} } = $props();

	const { close, open } = getContext('modal-window')

	let inverted = $derived(isThemeToggleChecked($app.theme))
    
    // We maintain a local editing copy to avoid modifying the store directly until "Save"
    let localConnection = $state(null)
    let selectedIndex = $state(-1) // -1 means no selection
    let isEditingNew = $state(false)

    // Init with the first connection if available
    $effect(() => {
        if (selectedIndex === -1 && $history.connection.length > 0 && !isEditingNew) {
            selectConnection(0)
        } else if ($history.connection.length === 0 && !isEditingNew) {
            addNewConnection()
        }
    })

    const selectConnection = (index) => {
        selectedIndex = index
        isEditingNew = false
        if (index >= 0) {
            localConnection = JSON.parse(JSON.stringify($history.connection[index]))
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
                dispatch('history/connection/delete', $history.connection[selectedIndex])
                if ($history.connection.length > 0) {
                    selectConnection(Math.max(0, selectedIndex - 1))
                } else {
                    addNewConnection()
                }
            } else if (isEditingNew) {
                // just cancel editing new
                if ($history.connection.length > 0) {
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
		const testWindowId = $app.windowId ? $app.windowId + '_test' : crypto.randomUUID();
		try {
			if (localConnection.useSshTunnel) {
				const tunnelResult = await openTunnel($state.snapshot(localConnection), testWindowId);
				if (tunnelResult.error) {
					dispatch('notification/add', {
						type: 'error',
						message: `SSH Tunnel: ${tunnelResult.error}`,
					});
					return;
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
				closeTunnel(testWindowId).catch(() => {});
			}
		}
	}

	const save = e => {
		if (e) e.preventDefault();

		if (!localConnection.useAuth) {
            localConnection.user = ''
            localConnection.password = ''
		}

        if (selectedIndex >= 0) {
            // "Edit" requires deleting old and adding new
            dispatch('history/connection/delete', $state.snapshot($history.connection[selectedIndex]))
        }
        dispatch('history/connection/add', $state.snapshot(localConnection))
        
        // Re-select it to stay on it
        dispatch('notification/add', { type: 'success', message: 'Connection saved' })
        isEditingNew = false
        setTimeout(() => selectConnection($history.connection.length - 1), 0)
	}

    const saveAndConnect = async (e) => {
        save(e)
        // Now connect
        dispatch('connection/update', $state.snapshot(localConnection))
        dispatch('connection/save', () => {
            close() // we don't open ConnectDialog if we connect successfully
        })
    }

	const onHeaderAdd = () => {
        localConnection.headers = [...localConnection.headers, { name: '', value: '' }]
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

<div class="scrolling content" style="display: flex; gap: 1rem; min-height: 400px; padding:0;">
    <!-- Sidebar -->
    <div class="ui vertical menu" class:inverted style="width: 250px; margin: 0; border-radius: 0; border-top: none; border-bottom: none; border-left: none;">
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_interactive_supports_focus -->
        <div class="item" role="button" onclick={addNewConnection} style="cursor: pointer; color: #21ba45; font-weight: bold;">
            <i class="plus icon"></i> Add New
        </div>
        {#if $history && $history.connection}
            {#each $history.connection as conn, i (i)}
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <!-- svelte-ignore a11y_interactive_supports_focus -->
                <div class="item" class:active={selectedIndex === i && !isEditingNew} role="button" onclick={() => selectConnection(i)} style="cursor: pointer;">
                    {conn.name || (conn.host + (conn.port ? ':' + conn.port : ''))}
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
                        <input
                            type="number"
                            id="port"
                            bind:value={localConnection.port}
                        />
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
        <button class="ui red button left floated" class:inverted onclick={deleteConnection}>
            Delete
        </button>
        <button class="ui button" class:inverted onclick={testConnection}>
            Test
        </button>
        <button type="button" class="ui blue button" class:inverted onclick={(e) => save(e)}>
            Save
        </button>
        <button type="submit" class="ui green right button" class:inverted form="manage-connection-form">
            Save & Connect
        </button>
    {/if}
</div>

<style>
    .left.floated {
        float: left;
    }
</style>
