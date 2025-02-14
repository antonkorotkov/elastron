<script>
	import { useStoreon } from '@storeon/svelte'
	import { getContext } from 'svelte'

	import API from '../../../api/elasticsearch'
	import { isThemeToggleChecked } from '../../../utils/helpers'
	import Headers from './Headers.svelte'

	const { dispatch, connection, history, app } = useStoreon(
		'connection',
		'history',
		'app'
	)

	const currentConnection = { ...$connection }

	let { onCancel = () => {} } = $props();
	export const onOkay = () => {}

	const { close } = getContext('modal-window')

	const _onCancel = () => {
		try {
			dispatch('connection/update', currentConnection || {})
			onCancel()
			close()
		} catch (e) {
			dispatch('notification/add', {
				type: 'error',
				message: e.message,
			})
		}
	}

	const deleteConnection = () => {
		try {
			dispatch('history/connection/delete', $connection)
			dispatch('connection/update', $history.connection[0] || [])
		} catch (e) {
			dispatch('notification/add', {
				type: 'error',
				message: e.message,
			})
		}
	}

	const testConnection = async () => {
		try {
			const api = new API($connection)
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
		}
	}

	const save = e => {
		e.preventDefault();

		if (!$connection.useAuth) {
			dispatch('connection/update', {
				user: '',
				password: '',
			})
		}
		dispatch('connection/save', close)
	}

	const onClearHistoryClick = () => {
		dispatch('history/connection/clear')
	}

	const onPreviousChange = e => {
		const index = e.target.value
		if (index >= 0) {
			dispatch('connection/update', $history.connection[index])
		} else {
			dispatch('connection/clear')
		}
	}

	const onHeaderAdd = () => {
		dispatch('connection/update', {
			headers: [...$connection.headers, { name: '', value: '' }],
		})
	}

	const onHeaderDelete = index => {
		let headers = [...$connection.headers]
		headers.splice(index, 1)

		dispatch('connection/update', {
			headers,
		})
	}

	const onHeaderChange = (data, value) => {
		const { index, field } = data
		let headers = [...$connection.headers]

		headers[index][field] = value

		dispatch('connection/update', {
			headers,
		})
	}

	let inverted = $derived(isThemeToggleChecked($app.theme))
</script>

<div class="ui header">Connection Settings</div>

<div class="scrolling content">
	{#if $history.connection.length}
		<div class="ui form" class:inverted>
			<div class="fields">
				<div class="sixteen wide field">
					<label for="previous">Previous</label>
					<div class="ui input">
						<select
							id="previous"
							class="ui dropdown"
							onchange={onPreviousChange}
						>
							<option value="-2">Select Connection</option>
							<option value="-1">New Connection</option>
							{#if $history.connection.length}
								{#each $history.connection as connection, i}
									<option value={i}>
										{#if connection.name}
											{connection.name}
										{:else}
											{connection.host}{connection.port
												? `:${connection.port}`
												: ''}
										{/if}
									</option>
								{/each}
							{/if}
						</select>
						<!-- svelte-ignore a11y_click_events_have_key_events -->
						<div
							role="button"
							tabindex="0"
							class="ui button"
							class:inverted
							onclick={onClearHistoryClick}
						>
							Clear
						</div>
					</div>
				</div>
			</div>
		</div>
	{/if}
	<form
		class="ui form segment"
		class:inverted
		onsubmit={save}
		id="connection-form"
	>
		<div class="fields">
			<div class="sixteen wide field">
				<label for="name">Name</label>
				<input
					type="text"
					id="name"
					required={true}
					onchange={e =>
						dispatch('connection/update', {
							name: e.target.value,
						})}
					maxlength="32"
					value={$connection.name || ''}
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
					onchange={e =>
						dispatch('connection/update', {
							host: e.target.value,
						})}
					value={$connection.host}
				/>
			</div>
			<div class="four wide field">
				<label for="port">Port</label>
				<input
					type="number"
					id="port"
					onchange={e =>
						dispatch('connection/update', {
							port: e.target.value,
						})}
					value={$connection.port}
				/>
			</div>
		</div>
		<div class="field">
			<div class="ui checkbox">
				<input
					id="auth"
					type="checkbox"
					checked={$connection.useAuth}
					onchange={e =>
						dispatch('connection/update', {
							useAuth: e.target.checked,
						})}
				/>
				<label for="auth">Basic Auth</label>
			</div>
		</div>
		{#if $connection.useAuth}
			<div class="fields">
				<div class="eight wide field">
					<label for="user">User</label>
					<input
						required={$connection.useAuth}
						type="text"
						id="user"
						onchange={e =>
							dispatch('connection/update', {
								user: e.target.value,
							})}
						value={$connection.user}
					/>
				</div>
				<div class="eight wide field">
					<label for="password">Password</label>
					<input
						required={$connection.useAuth}
						type="password"
						id="password"
						onchange={e =>
							dispatch('connection/update', {
								password: e.target.value,
							})}
						value={$connection.password}
					/>
				</div>
			</div>
		{/if}
		<div class="field">
			<div class="ui checkbox">
				<input
					id="headers"
					type="checkbox"
					checked={$connection.addHeaders}
					onchange={e =>
						dispatch('connection/update', {
							addHeaders: e.target.checked,
						})}
				/>
				<label for="headers">Add Headers</label>
			</div>
		</div>
		{#if $connection.addHeaders}
			<Headers
				headers={$connection.headers}
				onAdd={onHeaderAdd}
				onChange={onHeaderChange}
				onDelete={onHeaderDelete}
			/>
		{/if}
	</form>
</div>

<div class="actions">
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<div
		class="ui black deny button right"
		class:inverted
		onclick={_onCancel}
		role="button"
		tabindex="0"
	>
		Cancel
	</div>
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<div
		class="ui red right button"
		class:inverted
		onclick={deleteConnection}
		role="button"
		tabindex="0"
	>
		Delete
	</div>
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<div
		class="ui right button"
		class:inverted
		onclick={testConnection}
		role="button"
		tabindex="0"
	>
		Test
	</div>
	<button
		type="submit"
		class="ui green right button"
		class:inverted
		form="connection-form"
	>
		Save
	</button>
</div>

<style>
	#previous {
		margin-right: 1rem;
	}

	.ui.form.segment {
		padding: 0;
		border: 0;
		box-shadow: none;
	}
</style>
