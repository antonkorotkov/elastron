<script>
	import { getContext, untrack } from 'svelte'
	import { useStoreon } from '@storeon/svelte'
	import API from '$lib/api/elasticsearch'
	import { isThemeToggleChecked } from '$lib/utils/helpers'
	import JsonEditor from '$lib/components/JsonEditor.svelte'
	import AdvancedDropdown from '$lib/components/inputs/AdvancedDropdown.svelte'
	import { createRoleFinder } from '$lib/security/roleFinder.js'
	import { describeRules, formatValue } from '$lib/security/mappingRules.js'
	import { refuseMappingChange, rolesComeFromMappings } from '../guards.js'
	import {
		FIELDS,
		applyRules,
		emptyCondition,
		emptyMapping,
		emptyRulesForm,
		parseRules,
		rulesProblem,
		toWritableMapping,
	} from './mappingModel.js'

	// `existing` is the mapping as the cluster holds it; RoleMappingDialog
	// fetches it.
	let { name = null, existing = null } = $props()

	const { close } = getContext('modal-window')
	const { dispatch, app, connection, securityRoleMappings, securityIdentity } = useStoreon(
		'app',
		'connection',
		'securityRoleMappings',
		'securityIdentity'
	)

	let inverted = $derived(isThemeToggleChecked($app.theme))
	let isNew = $derived(!name)
	let readOnly = $derived(Boolean(existing?.readOnly))

	// svelte-ignore state_referenced_locally
	let mappingName = $state(name || '')

	// The full mapping is the source of truth. Rules are rebuilt from the form
	// only once the user touches them, so rules the form cannot show, and the
	// exact shape of those it can, go back to the cluster as they came.
	// svelte-ignore state_referenced_locally
	let mapping = $state(existing ? toWritableMapping(existing) : emptyMapping())
	// svelte-ignore state_referenced_locally
	let form = $state(existing ? parseRules(existing.rules) : emptyRulesForm())
	// svelte-ignore state_referenced_locally
	let rulesTouched = $state(!existing)

	let usesTemplates = $derived(Array.isArray(mapping.role_templates))
	let hasMetadata = $derived(Object.keys(mapping.metadata || {}).length > 0)

	let mode = $state('form')
	let jsonEditor = $state(null)
	let jsonError = $state('')

	let rolesError = $state('')
	const findRoles = createRoleFinder(
		text => new API($connection, $app.windowId).querySecurityRoles({ search: text }),
		message => (rolesError = message)
	)

	const touchRules = change => {
		change()
		rulesTouched = true
	}

	const updateCondition = (i, changes) =>
		touchRules(() => (form.conditions[i] = { ...form.conditions[i], ...changes }))
	const addCondition = () => touchRules(() => form.conditions.push(emptyCondition()))
	const removeCondition = i => touchRules(() => form.conditions.splice(i, 1))
	const updateException = changes => touchRules(() => (form.exception = { ...form.exception, ...changes }))
	const addException = () => touchRules(() => (form.exception = emptyCondition()))
	const removeException = () => touchRules(() => (form.exception = null))
	const setKind = kind => touchRules(() => (form.kind = kind))

	// One value per line, since a DN holds commas. A line left as it was keeps
	// the value's type, so a number or null in metadata survives an edit.
	const valuesText = values => values.map(formatValue).join('\n')
	const parseValues = (text, previous) =>
		text
			.split('\n')
			.map(line => line.trim())
			.filter(Boolean)
			.map(line => previous.find(value => formatValue(value) === line) ?? line)

	const currentBody = () => (form && rulesTouched ? applyRules(mapping, form) : mapping)

	// Pulls whatever the other mode holds, so an edit is not dropped.
	const switchMode = next => {
		if (next === mode) return
		if (mode === 'form') {
			mapping = currentBody()
		}
		if (mode === 'json' && jsonEditor) {
			try {
				mapping = jsonEditor.get()
				jsonError = ''
			} catch (err) {
				jsonError = err?.message || 'The definition is not valid JSON.'
				return
			}
			// Without rules there is nothing to keep, so the form starts afresh.
			const hasRules = mapping.rules && Object.keys(mapping.rules).length > 0
			form = hasRules ? parseRules(mapping.rules) : emptyRulesForm()
			rulesTouched = !hasRules
		}
		if (next === 'json') jsonError = ''
		mode = next
	}

	// The store repeats this check against the cluster before sending; here it
	// warns before the user commits. Definitions for roles picked here are
	// fetched as they come into play.
	let definitions = $state({})
	let catalogue = $derived({ ...$securityRoleMappings.catalogue, ...definitions })
	let guarded = $derived(!isNew && Boolean(existing) && rolesComeFromMappings($securityIdentity))

	$effect(() => {
		if (!guarded) return
		const known = untrack(() => catalogue)
		const wanted = (mapping.roles || []).filter(role => !(role in known))
		if (!wanted.length) return

		const settle = found => {
			definitions = {
				...definitions,
				...Object.fromEntries(wanted.map(role => [role, found?.[role] ?? null])),
			}
		}
		new API($connection, $app.windowId)
			.getSecurityRolesByName(wanted)
			.then(settle, () => settle({}))
	})

	const judge = body =>
		guarded
			? refuseMappingChange(
					existing,
					body,
					$securityRoleMappings.entries.filter(m => m.name !== name),
					$securityIdentity,
					Object.fromEntries(Object.entries(catalogue).filter(([, definition]) => definition))
				)
			: null

	let rulesError = $derived(mode === 'form' && form && rulesTouched ? rulesProblem(form) : null)
	let formVerdict = $derived(mode === 'form' && !rulesError ? judge(form && rulesTouched ? applyRules(mapping, form) : mapping) : null)
	let jsonVerdict = $state(null)
	let verdict = $derived(mode === 'form' ? formVerdict : jsonVerdict)
	let acknowledged = $state(false)
	// A warning that clears and comes back is a new one to acknowledge.
	$effect(() => {
		if (verdict?.level !== 'confirm') acknowledged = false
	})

	let nameTaken = $derived(isNew && $securityRoleMappings.entries.some(m => m.name === mappingName.trim()))
	let nameError = $derived(
		!isNew ? null : !mappingName.trim() ? 'A mapping name is required.' : nameTaken ? 'A role mapping with this name already exists.' : null
	)
	let rolesMissing = $derived(mode === 'form' && !usesTemplates && !(mapping.roles || []).length)
	let canSave = $derived(
		!readOnly &&
			!nameError &&
			!jsonError &&
			!rulesError &&
			!rolesMissing &&
			verdict?.level !== 'refuse' &&
			(verdict?.level !== 'confirm' || acknowledged)
	)

	const save = e => {
		e?.preventDefault()
		if (readOnly || !mappingName.trim()) return

		let body
		if (mode === 'json' && jsonEditor) {
			try {
				body = jsonEditor.get()
			} catch (err) {
				jsonError = err?.message || 'The definition is not valid JSON.'
				return
			}
			// A JSON edit cannot be judged as it is typed, so it is judged here and
			// held back until any warning has been seen and acknowledged.
			const found = judge(body)
			if (found?.message !== jsonVerdict?.message) {
				jsonVerdict = found
				acknowledged = false
			}
			if (found && (found.level === 'refuse' || !acknowledged)) return
		} else {
			if (!canSave) return
			body = currentBody()
		}

		dispatch('security/roleMappings/put', {
			name: mappingName.trim(),
			body,
			isNew,
			acknowledged: verdict?.level === 'confirm' && acknowledged,
		})
		close()
	}
</script>

<div class="ui header">
	{isNew ? 'Create New Role Mapping' : readOnly ? `${name} (read-only)` : `Edit ${name}`}
</div>

<div class="content">
	<div class="ui tiny basic buttons mode-switch" class:inverted>
		<button class="ui button" class:active={mode === 'form'} onclick={() => switchMode('form')}>
			Form
		</button>
		<button class="ui button" class:active={mode === 'json'} onclick={() => switchMode('json')}>
			JSON
		</button>
	</div>

	<form class="ui form" class:inverted onsubmit={save} id="role-mapping-form">
		{#if isNew}
			<div class="field">
				<label for="mapping-name">Mapping Name</label>
				<input type="text" id="mapping-name" bind:value={mappingName} autocomplete="off" />
				{#if nameTaken}<span class="ui grey text">{nameError}</span>{/if}
			</div>
		{/if}

		{#if readOnly}
			<div class="ui small message">
				This mapping is defined in the cluster's operator settings, so it can only be viewed here.
			</div>
		{/if}

		{#if mode === 'form'}
			{#if jsonError}
				<div class="ui small warning message">{jsonError}</div>
			{/if}
			{#if hasMetadata}
				<div class="ui small warning message">
					This mapping also sets metadata, which this form does not show. It is kept as it is when
					you save. Use the JSON view to edit it.
				</div>
			{/if}

			<div class="field">
				<div class="ui checkbox" class:inverted>
					<input
						id="mapping-enabled"
						type="checkbox"
						disabled={readOnly}
						checked={mapping.enabled !== false}
						onchange={e => (mapping = { ...mapping, enabled: e.target.checked })}
					/>
					<label for="mapping-enabled">Enabled</label>
				</div>
			</div>

			<div class="field">
				<label for="mapping-roles">Roles</label>
				{#if usesTemplates}
					<div id="mapping-roles" class="ui small message">
						This mapping grants roles through templates, which are worked out for each user when
						they sign in. Use the JSON view to change them.
						<pre class="templates">{(mapping.role_templates || [])
								.map(t => (typeof t.template === 'string' ? t.template : JSON.stringify(t.template)))
								.join('\n')}</pre>
					</div>
				{:else}
					<AdvancedDropdown
						loadOptions={findRoles}
						selectedValue={mapping.roles || []}
						multiple
						isCreatable={false}
						isClearable
						isDisabled={readOnly}
						placeholder="Search roles…"
						onChange={picked => (mapping = { ...mapping, roles: picked })}
						floatingConfig={{ strategy: 'fixed' }}
					/>
					{#if rolesError}
						<span class="ui grey text">{rolesError}</span>
					{:else if rolesMissing && !readOnly}
						<span class="ui grey text">A mapping needs at least one role.</span>
					{/if}
				{/if}
			</div>

			<div class="field">
				<label for="mapping-rules">Rules</label>
				{#if !form}
					<div id="mapping-rules" class="ui small message">
						These rules nest groups more deeply than this form shows. They are kept as they are when
						you save. Use the JSON view to change them.
						<pre class="templates">{describeRules(mapping.rules)}</pre>
					</div>
				{:else}
					<div id="mapping-rules">
						<div class="inline fields">
							<div class="field">
								<div class="ui radio checkbox" class:inverted>
									<input
										id="kind-all"
										type="radio"
										name="mapping-kind"
										disabled={readOnly}
										checked={form.kind === 'all'}
										onchange={() => setKind('all')}
									/>
									<label for="kind-all">All conditions must hold</label>
								</div>
							</div>
							<div class="field">
								<div class="ui radio checkbox" class:inverted>
									<input
										id="kind-any"
										type="radio"
										name="mapping-kind"
										disabled={readOnly}
										checked={form.kind === 'any'}
										onchange={() => setKind('any')}
									/>
									<label for="kind-any">Any condition may hold</label>
								</div>
							</div>
						</div>

						{#snippet condition(item, i, onChange, onRemove, label)}
							<div class="ui segment condition" class:inverted data-testid="condition">
								<div class="condition-head">
									<span class="ui grey text">{label}</span>
									{#if !readOnly}
										<button
											type="button"
											class="ui mini basic red compact button"
											class:inverted
											onclick={onRemove}
										>
											Remove
										</button>
									{/if}
								</div>
								<div class="two fields">
									<div class="field">
										<label for="condition-field-{i}">Field</label>
										<select
											id="condition-field-{i}"
											disabled={readOnly}
											value={item.field}
											onchange={e => onChange({ field: e.target.value })}
										>
											{#each FIELDS as option (option.value)}
												<option value={option.value}>{option.label}</option>
											{/each}
										</select>
									</div>
									{#if item.field === 'metadata'}
										<div class="field">
											<label for="condition-key-{i}">Metadata Key</label>
											<input
												id="condition-key-{i}"
												type="text"
												disabled={readOnly}
												value={item.key}
												oninput={e => onChange({ key: e.target.value })}
											/>
										</div>
									{/if}
								</div>
								<div class="field">
									<label for="condition-values-{i}">Values</label>
									<textarea
										id="condition-values-{i}"
										rows="2"
										disabled={readOnly}
										value={valuesText(item.values)}
										oninput={e => onChange({ values: parseValues(e.target.value, item.values) })}
										placeholder="One per line, e.g. cn=ops,ou=groups,dc=example,dc=com"
									></textarea>
									<span class="ui grey text">
										Any value may match. Use * as a wildcard, or /…/ for a regular expression.
									</span>
								</div>
							</div>
						{/snippet}

						{#each form.conditions as item, i (i)}
							{@render condition(
								item,
								i,
								changes => updateCondition(i, changes),
								() => removeCondition(i),
								`Condition ${i + 1}`
							)}
						{/each}

						{#if form.exception}
							{@render condition(
								form.exception,
								'except',
								updateException,
								removeException,
								'Except when'
							)}
						{/if}

						{#if !readOnly}
							<button type="button" class="ui tiny basic button" class:inverted onclick={addCondition}>
								Add Condition
							</button>
							{#if !form.exception}
								{#if form.kind === 'all'}
									<button type="button" class="ui tiny basic button" class:inverted onclick={addException}>
										Add Exception
									</button>
								{:else}
									<span class="ui grey text">
										An exception needs a group whose conditions must all hold.
									</span>
								{/if}
							{/if}
						{/if}

						{#if rulesError}
							<div class="ui small warning message">{rulesError}</div>
						{/if}
					</div>
				{/if}
			</div>
		{:else}
			<div class="field">
				<label for="mapping-json">Mapping Definition</label>
				<div id="mapping-json">
					<JsonEditor
						value={mapping}
						bind:editor={jsonEditor}
						options={{ mode: readOnly ? 'view' : 'code', mainMenuBar: false }}
						onError={err => (jsonError = err?.message || 'The editor failed to load.')}
					/>
				</div>
				{#if jsonError}<span class="ui grey text">{jsonError}</span>{/if}
			</div>
		{/if}

		{#if verdict}
			<div class="ui small warning message" data-testid="mapping-lockout">{verdict.message}</div>
			{#if verdict.level === 'confirm'}
				<div class="field">
					<div class="ui checkbox" class:inverted>
						<input id="mapping-acknowledge" type="checkbox" bind:checked={acknowledged} />
						<label for="mapping-acknowledge">I understand this may lock me out</label>
					</div>
				</div>
			{/if}
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
			form="role-mapping-form"
			disabled={mode === 'form' && !canSave}
		>
			{isNew ? 'Create' : 'Save'}
		</button>
	{/if}
</div>

<style>
	.mode-switch {
		margin-bottom: 1rem;
	}
	.condition {
		margin-bottom: 0.75rem !important;
	}
	.condition-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 0.5rem;
	}
	.templates {
		white-space: pre-wrap;
		word-break: break-all;
		margin: 0.5em 0 0;
	}
	#mapping-json :global(.jsoneditor) {
		height: 20rem;
	}
</style>
