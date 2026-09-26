<script>
	import { getContext } from 'svelte'
	import { useStoreon } from '@storeon/svelte'
	import API from '$lib/api/elasticsearch'
	import { isThemeToggleChecked } from '$lib/utils/helpers'
	import JsonEditor from '$lib/components/JsonEditor.svelte'
	import AdvancedDropdown from '$lib/components/inputs/AdvancedDropdown.svelte'
	import IndexBlockRestrictions from './IndexBlockRestrictions.svelte'
	import {
		QUERY_FORM,
		readFieldSecurity,
		readQuery,
		refuseFieldSecurity,
		writeQuery,
	} from './blockQuery.js'
	import {
		applyEdit,
		emptyIndexBlock,
		emptyRole,
		parseList,
		toWritableRole,
		unmodelledFields,
	} from './roleModel.js'

	let { name = null } = $props()

	const { close } = getContext('modal-window')
	const { dispatch, app, connection, securityRoles, securityPrivileges } = useStoreon(
		'app',
		'connection',
		'securityRoles',
		'securityPrivileges'
	)

	let inverted = $derived(isThemeToggleChecked($app.theme))
	let isNew = $derived(!name)

	const existing = $securityRoles.entries.find(r => r.name === name)
	let readOnly = $derived(Boolean(existing?.reserved))

	// svelte-ignore state_referenced_locally
	let roleName = $state(name || '')

	// The full definition is the source of truth; structured edits apply onto
	// it so fields the form does not model survive a round trip.
	let role = $state(existing ? toWritableRole(existing) : emptyRole())

	let blockEditors = {}

	const rememberEditor = (i, editor) => {
		if (editor) blockEditors[i] = editor
		else delete blockEditors[i]
	}

	const applyRestrictions = () => {
		const blocks = [...(role.indices || [])]

		for (let i = 0; i < blocks.length; i += 1) {
			const block = { ...blocks[i] }

			const fieldRefusal = refuseFieldSecurity(readFieldSecurity(block))
			if (fieldRefusal) return { error: `Index block ${i + 1}: ${fieldRefusal}` }

			let held = readQuery(block)
			const editor = blockEditors[i]
			if (editor && held.form !== QUERY_FORM.NONE && !held.unmodelled) {
				try {
					held = { ...held, source: editor.get() }
				} catch (err) {
					return { error: `Index block ${i + 1}: ${err?.message || 'the query is not valid JSON.'}` }
				}
			}

			const query = writeQuery(held)
			if (query === undefined) delete block.query
			else block.query = query

			blocks[i] = block
		}

		return { indices: blocks }
	}

	let mode = $state('form')
	let jsonEditor = $state(null)
	let jsonError = $state('')

	let clusterOptions = $derived($securityPrivileges.cluster || [])
	let indexOptions = $derived($securityPrivileges.index || [])
	let hidden = $derived(unmodelledFields(role))

	const patch = changes => {
		role = applyEdit(role, changes)
	}


	const updateBlock = (i, changes) => {
		const blocks = [...(role.indices || [])]
		const block = { ...blocks[i] }
		for (const [key, value] of Object.entries(changes)) {
			if (value === undefined) delete block[key]
			else block[key] = value
		}
		blocks[i] = block
		patch({ indices: blocks })
	}


	const addBlock = () => patch({ indices: [...(role.indices || []), emptyIndexBlock()] })

	const removeBlock = i => {
		const remaining = (role.indices || []).filter((_, idx) => idx !== i)
		patch({ indices: remaining })
		blockEditors = Object.fromEntries(
			Object.entries(blockEditors).filter(([key]) => Number(key) < remaining.length)
		)
	}

	// Pulls whatever the JSON editor holds, so an edit is not dropped.
	const switchMode = next => {
		if (next === mode) return
		if (mode === 'json' && jsonEditor) {
			try {
				role = jsonEditor.get()
				jsonError = ''
			} catch (err) {
				jsonError = err?.message || 'The definition is not valid JSON.'
				return
			}
			blockEditors = {}
		}
		// A stale error would survive the remount and keep Save disabled.
		if (next === 'json') jsonError = ''
		mode = next
	}

	let nameError = $derived(isNew && !roleName.trim() ? 'A role name is required.' : null)
	let canSave = $derived(!readOnly && !nameError && !jsonError)

	const save = e => {
		e?.preventDefault()
		if (readOnly) return
		if (!roleName.trim()) return

		let body = role

		if (mode === 'json' && jsonEditor) {
			try {
				body = jsonEditor.get()
			} catch (err) {
				jsonError = err?.message || 'The definition is not valid JSON.'
				return
			}
		} else {
			const applied = applyRestrictions()

			if (applied.error) {
				jsonError = applied.error
				return
			}
			body = { ...role, indices: applied.indices }
		}

		dispatch('security/roles/put', { name: roleName.trim(), body, isNew })
		close()
	}
</script>

<div class="ui header">
	{isNew ? 'Create New Role' : readOnly ? `${name} (reserved)` : `Edit ${name}`}
</div>

<div class="content">
	<!--
		`inverted` belongs on the group, not the buttons. Semantic styles
		`.ui.basic.inverted.buttons .button`; a bare `.ui.button` inside a basic
		group is painted near-black with !important, which no class on the child
		can override.
	-->
	<div class="ui tiny basic buttons mode-switch" class:inverted>
		<button class="ui button" class:active={mode === 'form'} onclick={() => switchMode('form')}>
			Form
		</button>
		<button class="ui button" class:active={mode === 'json'} onclick={() => switchMode('json')}>
			JSON
		</button>
	</div>

	<form class="ui form" class:inverted onsubmit={save} id="role-form">
		{#if isNew}
			<div class="field">
				<label for="role-name">Role Name</label>
				<input type="text" id="role-name" bind:value={roleName} autocomplete="off" />
			</div>
		{/if}

		{#if mode === 'form'}
			{#if jsonError}
				<div class="ui small warning message">{jsonError}</div>
			{/if}
			{#if hidden.length}
				<div class="ui small warning message">
					This role also sets {hidden.join(', ')}, which this form does not show.
					Those fields are kept as they are when you save. Use the JSON view to edit them.
				</div>
			{/if}

			<div class="field">
				<label for="role-cluster">Cluster Privileges</label>
				{#if clusterOptions.length}
					<AdvancedDropdown
						items={clusterOptions}
						selectedValue={role.cluster || []}
						multiple
						isCreatable={false}
						isClearable
						isDisabled={readOnly}
						placeholder="Search privileges…"
						onChange={picked => patch({ cluster: picked })}
						floatingConfig={{ strategy: 'fixed' }}
					/>
				{:else}
					<input
						type="text"
						id="role-cluster"
						disabled={readOnly}
						value={(role.cluster || []).join(', ')}
						oninput={e => patch({ cluster: parseList(e.target.value) })}
						placeholder="monitor, manage_own_api_key"
					/>
					<span class="ui grey text">
						The cluster did not report its privilege names, so these are free text.
					</span>
				{/if}
			</div>

			<div class="field">
				<label for="role-indices">Index Privileges</label>
				<div id="role-indices">
					{#each role.indices || [] as block, i (i)}
						<div class="ui segment block" class:inverted>
							<div class="block-head">
								<span class="ui grey text">Block {i + 1}</span>
								{#if !readOnly}
									<button
										type="button"
										class="ui mini basic red compact button"
										class:inverted
										onclick={() => removeBlock(i)}
									>
										Remove
									</button>
								{/if}
							</div>
							<div class="field">
								<label for="block-names-{i}">Index Patterns</label>
								<input
									id="block-names-{i}"
									type="text"
									disabled={readOnly}
									value={(block.names || []).join(', ')}
									oninput={e => updateBlock(i, { names: parseList(e.target.value) })}
									placeholder="logs-*, metrics-*"
								/>
							</div>
							<div class="field">
								<label for="block-privs-{i}">Privileges</label>
								{#if indexOptions.length}
									<AdvancedDropdown
										items={indexOptions}
										selectedValue={block.privileges || []}
										multiple
										isCreatable={false}
										isClearable
										isDisabled={readOnly}
										placeholder="Search privileges…"
										onChange={picked => updateBlock(i, { privileges: picked })}
										floatingConfig={{ strategy: 'fixed' }}
									/>
								{:else}
									<input
										type="text"
										id="block-privs-{i}"
										disabled={readOnly}
										value={(block.privileges || []).join(', ')}
										oninput={e => updateBlock(i, { privileges: parseList(e.target.value) })}
										placeholder="read, write"
									/>
								{/if}
							</div>
							<IndexBlockRestrictions
								{block}
								{readOnly}
								index={i}
								onChange={changes => updateBlock(i, changes)}
								onEditorChange={rememberEditor}
							/>
						</div>
					{/each}
					{#if !readOnly}
						<button type="button" class="ui tiny basic button" class:inverted onclick={addBlock}>
							Add Index Block
						</button>
					{/if}
				</div>
			</div>

			<div class="two fields">
				<div class="field">
					<label for="role-runas">Run As</label>
					<input
						type="text"
						id="role-runas"
						disabled={readOnly}
						value={(role.run_as || []).join(', ')}
						oninput={e => patch({ run_as: parseList(e.target.value) })}
						placeholder="usernames this role may impersonate"
					/>
				</div>
				<div class="field">
					<label for="role-description">Description</label>
					<input
						type="text"
						id="role-description"
						disabled={readOnly}
						value={role.description || ''}
						oninput={e => patch({ description: e.target.value })}
					/>
				</div>
			</div>
		{:else}
			<div class="field">
				<label for="role-json">Role Definition</label>
				<div id="role-json">
					<JsonEditor
						value={role}
						bind:editor={jsonEditor}
						options={{ mode: readOnly ? 'view' : 'code', mainMenuBar: false }}
						onError={err => (jsonError = err?.message || 'The editor failed to load.')}
					/>
				</div>
				{#if jsonError}<span class="ui grey text">{jsonError}</span>{/if}
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
		{readOnly ? 'Close' : 'Cancel'}
	</div>
	{#if !readOnly}
		<button
			type="submit"
			class="ui green right button"
			class:inverted
			form="role-form"
			disabled={!canSave}
		>
			{isNew ? 'Create' : 'Save'}
		</button>
	{/if}
</div>

<style>
	.mode-switch {
		margin-bottom: 1rem;
	}
	.block {
		margin-bottom: 0.75rem !important;
	}
	.block-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 0.5rem;
	}
	#role-json :global(.jsoneditor) {
		height: 20rem;
	}
</style>
