<script>
	import { getContext } from 'svelte'
	import { useStoreon } from '@storeon/svelte'
	import { isThemeToggleChecked } from '$lib/utils/helpers'
	import JsonEditor from '$lib/components/JsonEditor.svelte'

	const { close } = getContext('modal-window')
	const { dispatch, app } = useStoreon('app')
	let inverted = $derived(isThemeToggleChecked($app.theme))

	let name = $state('')
	let expiration = $state('')
	let restrict = $state(false)

	// Role descriptors are nested JSON, so they are edited in the same editor
	// the role dialog uses rather than a plain textarea.
	const DEFAULT_DESCRIPTORS = { restricted: { cluster: ['monitor'] } }
	let descriptors = $state(DEFAULT_DESCRIPTORS)
	let descriptorsEditor = $state(null)
	let editorError = $state('')

	// Populated once the key exists. The secret is in the creation response and
	// nowhere else: the cluster will not return it again, and it is deliberately
	// never written to the store.
	let created = $state(null)
	let copied = $state(false)

	/**
	 * Reads what the editor holds. In code mode its contents are only parsed on
	 * demand, so this is the one place that knows whether they are usable.
	 */
	const readDescriptors = () => {
		if (!descriptorsEditor) return { value: descriptors }
		try {
			return { value: descriptorsEditor.get() }
		} catch (err) {
			return { error: err?.message || 'Role descriptors are not valid JSON.' }
		}
	}

	let descriptorError = $derived(restrict ? editorError : null)

	let canCreate = $derived(Boolean(name.trim()) && !descriptorError)

	const create = e => {
		e?.preventDefault()
		if (!canCreate) return
		const body = { name: name.trim() }
		if (expiration.trim()) body.expiration = expiration.trim()

		if (restrict) {
			const { value, error } = readDescriptors()
			if (error) {
				editorError = error
				return
			}
			if (!value || typeof value !== 'object' || Array.isArray(value)) {
				editorError = 'Role descriptors must be a JSON object.'
				return
			}
			editorError = ''
			body.role_descriptors = value
		}

		dispatch('security/api-keys/create', {
			body,
			onCreated: key => {
				created = key
			},
		})
	}

	const copy = async e => {
		e?.preventDefault()
		await navigator.clipboard.writeText(created.encoded)
		copied = true
		setTimeout(() => (copied = false), 1500)
	}
</script>

{#if created}
	<div class="ui header">API Key Created</div>

	<div class="content">
		<div class="ui small warning message">
			This is the only time the key is shown. Elasticsearch does not store it in a
			form it can return again, so copy it now. If you lose it, invalidate this key
			and create another.
		</div>

		<div class="ui form" class:inverted>
			<div class="field">
				<label for="created-name">Name</label>
				<input type="text" id="created-name" value={created.name} readonly />
			</div>
			<div class="field">
				<label for="created-id">Id</label>
				<input type="text" id="created-id" value={created.id} readonly />
			</div>
			<div class="field">
				<label for="created-secret">Encoded Key</label>
				<div class="ui action input" class:inverted>
					<input
						type="text"
						id="created-secret"
						data-testid="api-key-secret"
						value={created.encoded}
						readonly
					/>
					<button class="ui basic button" class:inverted onclick={copy} type="button">
						<i class="{copied ? 'check' : 'copy outline'} icon"></i>
						{copied ? 'Copied' : 'Copy'}
					</button>
				</div>
			</div>
		</div>
	</div>

	<div class="actions">
		<button type="button" class="ui green right button" class:inverted onclick={close}>
			Done
		</button>
	</div>
{:else}
	<div class="ui header">Create New API Key</div>

	<div class="content">
		<form class="ui form" class:inverted onsubmit={create} id="api-key-form">
			<div class="field">
				<label for="ak-name">Name</label>
				<input type="text" id="ak-name" bind:value={name} autocomplete="off" />
			</div>

			<div class="field">
				<label for="ak-expiry">Expires After</label>
				<input
					type="text"
					id="ak-expiry"
					bind:value={expiration}
					placeholder="e.g. 7d, 12h, 30m — leave blank for no expiry"
				/>
			</div>

			<div class="field">
				<div class="ui checkbox" class:inverted>
					<input
						id="ak-restrict"
						type="checkbox"
						bind:checked={restrict}
						onchange={() => (editorError = '')}
					/>
					<label for="ak-restrict">Restrict What This Key May Do</label>
				</div>
				<span class="ui grey text">
					Without restrictions the key carries the same privileges as this account.
				</span>
			</div>

			{#if restrict}
				<div class="field">
					<label for="ak-descriptors">Role Descriptors</label>
					<div id="ak-descriptors">
						<JsonEditor
							value={descriptors}
							bind:editor={descriptorsEditor}
							options={{ mode: 'code', mainMenuBar: false }}
							onError={err => (editorError = err?.message || 'The editor failed to load.')}
						/>
					</div>
					{#if descriptorError}<span class="ui grey text">{descriptorError}</span>{/if}
				</div>
			{/if}
		</form>
	</div>

	<div class="actions">
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<div
			class="ui black deny button right"
			class:inverted
			onclick={close}
			role="button"
			tabindex="0"
		>
			Cancel
		</div>
		<button
			type="submit"
			class="ui green right button"
			class:inverted
			form="api-key-form"
			disabled={!canCreate}
		>
			Create
		</button>
	</div>
{/if}

<style>
	/* Tall enough to show a descriptor without scrolling, short enough that the
	   dialog still fits beside the other fields. */
	#ak-descriptors :global(.jsoneditor) {
		height: 16rem;
	}
</style>
