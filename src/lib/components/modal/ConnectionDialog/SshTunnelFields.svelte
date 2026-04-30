<script>
	let {
		useSshTunnel = $bindable(false),
		ssh = $bindable({}),
		inverted = false,
	} = $props()

	const browseKey = async () => {
		try {
			if (!window.showOpenFilePicker) {
				// Fallback: prompt user to paste key content
				ssh.privateKeyName = '__paste__'
				return
			}
			const [handle] = await window.showOpenFilePicker({
				types: [{ description: 'SSH Keys', accept: { '*/*': [] } }],
			})
			const file = await handle.getFile()
			ssh.privateKeyContent = await file.text()
			ssh.privateKeyName = file.name
		} catch (err) {
			// User cancelled the picker
			if (err.name !== 'AbortError') {
				console.error('File picker error:', err)
			}
		}
	}

	const clearKey = () => {
		ssh.privateKeyContent = ''
		ssh.privateKeyName = ''
	}
</script>

<div class="field">
	<div class="ui checkbox">
		<input id="ssh-tunnel" type="checkbox" bind:checked={useSshTunnel} />
		<label for="ssh-tunnel">Use SSH Tunnel</label>
	</div>
</div>

{#if useSshTunnel}
	<div class="ssh-tunnel-fields" class:inverted>
		<div class="fields">
			<div class="twelve wide field">
				<label for="ssh-host">SSH Host</label>
				<input
					type="text"
					id="ssh-host"
					required
					bind:value={ssh.host}
					placeholder="bastion.example.com"
				/>
			</div>
			<div class="four wide field">
				<label for="ssh-port">SSH Port</label>
				<input
					type="number"
					id="ssh-port"
					bind:value={ssh.port}
					placeholder="22"
				/>
			</div>
		</div>

		<div class="field">
			<label for="ssh-username">Username</label>
			<input
				type="text"
				id="ssh-username"
				required
				bind:value={ssh.username}
				placeholder="deploy"
			/>
		</div>

		<div class="field">
			<div class="ui radio-group">
				<div class="ui radio checkbox" class:inverted>
					<input
						type="radio"
						id="ssh-auth-password"
						name="ssh-auth-method"
						value="password"
						bind:group={ssh.authMethod}
					/>
					<label for="ssh-auth-password">Password</label>
				</div>
				<div
					class="ui radio checkbox"
					class:inverted
					style="margin-left: 1.5rem;"
				>
					<input
						type="radio"
						id="ssh-auth-key"
						name="ssh-auth-method"
						value="privateKey"
						bind:group={ssh.authMethod}
					/>
					<label for="ssh-auth-key">Private Key</label>
				</div>
			</div>
		</div>

		{#if ssh.authMethod === 'password'}
			<div class="field">
				<label for="ssh-password">SSH Password</label>
				<input
					type="password"
					id="ssh-password"
					required
					bind:value={ssh.password}
				/>
			</div>
		{:else}
			<div class="field">
				<label for="ssh-private-key">Private Key</label>
				<div class="ui action input">
					{#if ssh.privateKeyName && ssh.privateKeyName !== '__paste__'}
						<input
							type="text"
							id="ssh-private-key"
							value={ssh.privateKeyName}
							readonly
						/>
						<button
							class="ui button"
							class:inverted
							type="button"
							onclick={clearKey}
						>
							Clear
						</button>
					{:else}
						<input
							type="text"
							id="ssh-private-key"
							placeholder="No key selected"
							readonly
						/>
						<button
							class="ui button"
							class:inverted
							type="button"
							onclick={browseKey}
						>
							Browse...
						</button>
					{/if}
				</div>
			</div>

			{#if ssh.privateKeyName === '__paste__'}
				<div class="field">
					<label for="ssh-key-content">Paste Private Key Content</label>
					<textarea
						id="ssh-key-content"
						rows="6"
						bind:value={ssh.privateKeyContent}
						placeholder="-----BEGIN OPENSSH PRIVATE KEY-----&#10;..."
						style="font-family: monospace; font-size: 0.85em;"
					></textarea>
				</div>
			{/if}

			<div class="field">
				<label for="ssh-passphrase">Passphrase (optional)</label>
				<input
					type="password"
					id="ssh-passphrase"
					bind:value={ssh.passphrase}
				/>
			</div>
		{/if}
	</div>
{/if}

<style>
	.ssh-tunnel-fields {
		margin-top: 0.5rem;
		padding: 0.75rem;
		border-left: 3px solid rgba(100, 100, 100, 0.3);
		margin-bottom: 0.5rem;
		padding-right: 0;
	}

	.radio-group {
		display: flex;
		align-items: center;
		padding-top: 0.35rem;
	}
</style>
