<script>
	import { getContext } from 'svelte'
	import { useStoreon } from '@storeon/svelte'
	import API from '$lib/api/elasticsearch'
	import { isThemeToggleChecked } from '$lib/utils/helpers'
	import JsonEditor from '$lib/components/JsonEditor.svelte'
	import AdvancedDropdown from '$lib/components/inputs/AdvancedDropdown.svelte'
	import IndexBlockRestrictions from './IndexBlockRestrictions.svelte'
	import {
		readFieldSecurity,
		readQuery,
		refuseFieldSecurity,
		writeFieldSecurity,
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

	// The dialog is constructed per open, so capturing the name once is the
	// intent: the field is the user's to edit from here on.
	// svelte-ignore state_referenced_locally
	let roleName = $state(name || '')

	/**
	 * The full definition, held as the source of truth. Structured edits are
	 * applied onto it so fields the form does not model survive a round trip.
	 */
	let role = $state(existing ? toWritableRole(existing) : emptyRole())

	/*
	 * Each block's restrictions are held alongside the block, read from the
	 * form the cluster reported. Untouched entries write back byte for byte,
	 * including a query this editor cannot model.
	 */
	let restrictions = $state(
		(role.indices || []).map(block => ({
			query: readQuery(block),
			fieldSecurity: readFieldSecurity(block),
		}))
	)
	// Keyed by block position. A plain object rather than a Map: it is a lookup,
	// not reactive state.
	let blockEditors = {}

	const setRestriction = (i, patch) => {
		const next = [...restrictions]
		next[i] = { ...next[i], ...patch }
		restrictions = next
	}

	const rememberEditor = (i, editor) => {
		if (editor) blockEditors[i] = editor
		else delete blockEditors[i]
	}

	/**
	 * Folds each block's restrictions back into the definition. Reads the live
	 * editor where there is one, so an edit that has not been committed on blur
	 * is not lost, and reports a template that does not render.
	 */
	const applyRestrictions = async () => {
		const blocks = [...(role.indices || [])]

		for (let i = 0; i < blocks.length; i += 1) {
			const held = restrictions[i]
			if (!held) continue

			const fieldRefusal = refuseFieldSecurity(held.fieldSecurity)
			if (fieldRefusal) return { error: `Index block ${i + 1}: ${fieldRefusal}` }

			let query = held.query
			const editor = blockEditors[i]
			if (editor && query.form !== 'none' && !query.unmodelled) {
				try {
					query = { ...query, source: editor.get() }
				} catch (err) {
					return { error: `Index block ${i + 1}: ${err?.message || 'the query is not valid JSON.'}` }
				}
			}

			// The cluster accepts a template whose syntax is broken and only
			// fails later, when a user's request is evaluated.
			if (query.form === 'template' && !query.unmodelled && query.source) {
				try {
					const api = new API($connection)
					await api.renderSecurityQueryTemplate(JSON.stringify(query.source))
				} catch (err) {
					return { error: `Index block ${i + 1}: the template does not render. ${err?.message || ''}`.trim() }
				}
			}

			const block = { ...blocks[i] }
			const nextQuery = writeQuery(query)
			if (nextQuery === undefined) delete block.query
			else block.query = nextQuery

			const nextFields = writeFieldSecurity(held.fieldSecurity)
			if (nextFields === undefined) delete block.field_security
			else block.field_security = nextFields

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
		blocks[i] = { ...blocks[i], ...changes }
		patch({ indices: blocks })
	}


	const addBlock = () => {
		patch({ indices: [...(role.indices || []), emptyIndexBlock()] })
		restrictions = [...restrictions, { query: readQuery({}), fieldSecurity: readFieldSecurity({}) }]
	}

	const removeBlock = i => {
		patch({ indices: (role.indices || []).filter((_, idx) => idx !== i) })
		restrictions = restrictions.filter((_, idx) => idx !== i)
		// Editors are keyed by position, so the map is rebuilt rather than
		// left pointing at the wrong block.
		blockEditors = {}
	}

	// Switching to the form pulls whatever the JSON editor holds, so an edit
	// made in one mode is never silently dropped by the other.
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
		}
		// A fresh editor starts clean. Without this an error from the previous
		// one would survive the remount and keep Save disabled.
		if (next === 'json') jsonError = ''
		mode = next
	}

	let nameError = $derived(isNew && !roleName.trim() ? 'A role name is required.' : null)
	let canSave = $derived(!readOnly && !nameError && !jsonError)

	let saving = $state(false)

	const save = async e => {
		e?.preventDefault()
		if (readOnly || saving) return
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
			// The form owns each block's restrictions, so they are folded back
			// in here. This also renders any template, which the cluster does
			// not check when it saves the role.
			saving = true
			const applied = await applyRestrictions()
			saving = false

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
								names={block.names || []}
								query={restrictions[i]?.query}
								fieldSecurity={restrictions[i]?.fieldSecurity}
								{readOnly}
								index={i}
								onQueryChange={next => setRestriction(i, { query: next })}
								onFieldSecurityChange={next => setRestriction(i, { fieldSecurity: next })}
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
			class:loading={saving}
			form="role-form"
			disabled={!canSave || saving}
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
