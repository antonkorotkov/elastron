<script>
	import { useStoreon } from '@storeon/svelte'
	import { isThemeToggleChecked } from '$lib/utils/helpers'
	import JsonEditor from '$lib/components/JsonEditor.svelte'
	import API from '$lib/api/elasticsearch'
	import { CAUSE, classifySecurityError } from '$lib/security/causes.js'
	import { QUERY_FORM, refuseFieldSecurity } from './blockQuery.js'
	import { parseList } from './roleModel.js'

	/**
	 * The document query and field restrictions of one index block, edited in
	 * the block rather than in the role's full definition. A role commonly
	 * restricts several patterns differently, and finding the right entry in
	 * the whole-role JSON is work the editor should be doing.
	 */
	let {
		names = [],
		query = { form: QUERY_FORM.NONE, source: null },
		fieldSecurity = { grant: [], except: [] },
		readOnly = false,
		index = 0,
		onQueryChange = () => {},
		onFieldSecurityChange = () => {},
		onEditorChange = () => {},
	} = $props()

	const { app, connection } = useStoreon('app', 'connection')
	let inverted = $derived(isThemeToggleChecked($app.theme))

	let editor = $state(null)
	let editorError = $state('')

	// Best-effort only: an account holding just manage_security is refused
	// this while still being allowed to save the role, so a refusal means
	// "no preview", never a failure.
	let preview = $state(null)
	let previewing = $state(false)

	let hasQuery = $derived(query.form !== QUERY_FORM.NONE)
	let isTemplate = $derived(query.form === QUERY_FORM.TEMPLATE)
	let fieldRefusal = $derived(refuseFieldSecurity(fieldSecurity))

	$effect(() => {
		onEditorChange(index, editor)
	})

	const setForm = form => {
		preview = null
		editorError = ''
		if (form === QUERY_FORM.NONE) return onQueryChange({ form, source: null })
		onQueryChange({
			...query,
			form,
			source: query.source ?? { match_all: {} },
			unmodelled: false,
		})
	}

	const runPreview = async () => {
		previewing = true
		preview = null
		try {
			const source = editor ? editor.get() : query.source
			const api = new API($connection)

			if (isTemplate) {
				const rendered = await api.renderSecurityQueryTemplate(JSON.stringify(source))
				const counted = await api.previewSecurityQuery(names, rendered.query)
				preview = { ...counted, rendered: rendered.query }
			} else {
				preview = await api.previewSecurityQuery(names, source)
			}
		} catch (err) {
			// A refusal is not a failure the user needs to act on here.
			preview =
				classifySecurityError(err) === CAUSE.PRIVILEGE
					? { unavailable: true }
					: { failed: err?.message || 'The preview could not be run.' }
		}
		previewing = false
	}
</script>

<div class="restrictions">
	<div class="field">
		<span class="label-like">Document query</span>
		<div class="ui tiny basic buttons" class:inverted>
			<button type="button" class="ui button" class:active={!hasQuery} disabled={readOnly} onclick={() => setForm(QUERY_FORM.NONE)}>
				None
			</button>
			<button type="button" class="ui button" class:active={hasQuery && !isTemplate} disabled={readOnly} onclick={() => setForm(QUERY_FORM.QUERY)}>
				Query
			</button>
			<button type="button" class="ui button" class:active={isTemplate} disabled={readOnly} onclick={() => setForm(QUERY_FORM.TEMPLATE)}>
				Template
			</button>
		</div>

		{#if hasQuery}
			{#if query.unmodelled}
				<span class="ui grey text">
					This query is stored in a form this editor cannot show, such as a stored
					template. It is kept exactly as it is. Use the JSON view to change it.
				</span>
			{:else}
				{#if isTemplate}
					<span class="ui grey text">
						A template interpolates the requesting user, for example
						<code>{'{{_user.username}}'}</code>. Its source is shown here as JSON.
					</span>
				{/if}
				<div class="query-editor" id="block-query-{index}">
					<JsonEditor
						value={query.source}
						bind:editor
						options={{ mode: readOnly ? 'view' : 'code', mainMenuBar: false }}
						onError={err => (editorError = err?.message || 'The editor failed to load.')}
					/>
				</div>
				{#if editorError}<span class="ui grey text">{editorError}</span>{/if}

				{#if !readOnly}
					<button type="button" class="ui tiny basic button" class:inverted class:loading={previewing} onclick={runPreview}>
						<i class="eye icon"></i> What does this match?
					</button>
				{/if}

				{#if preview?.unavailable}
					<span class="ui grey text">
						This account cannot read those indices, so there is nothing to
						preview. The role can still be saved.
					</span>
				{:else if preview?.failed}
					<span class="ui grey text">{preview.failed}</span>
				{:else if preview}
					<span class="ui grey text">
						Matches <b>{preview.matching}</b> of {preview.total} documents across
						{names.join(', ') || 'these patterns'}.
						{#if preview.matching === 0}
							Nothing matches, so this role would see no documents.
						{/if}
					</span>
				{/if}
			{/if}
		{/if}
	</div>

	<div class="two fields">
		<div class="field">
			<label for="block-grant-{index}">Fields granted</label>
			<input
				id="block-grant-{index}"
				type="text"
				disabled={readOnly}
				value={fieldSecurity.grant.join(', ')}
				oninput={e => onFieldSecurityChange({ ...fieldSecurity, grant: parseList(e.target.value) })}
				placeholder="leave blank for every field"
			/>
		</div>
		<div class="field">
			<label for="block-except-{index}">Fields excepted</label>
			<input
				id="block-except-{index}"
				type="text"
				disabled={readOnly}
				value={fieldSecurity.except.join(', ')}
				oninput={e => onFieldSecurityChange({ ...fieldSecurity, except: parseList(e.target.value) })}
				placeholder="withheld from the granted fields"
			/>
		</div>
	</div>
	{#if fieldRefusal}
		<span class="ui grey text">{fieldRefusal}</span>
	{/if}
</div>

<style>
	.restrictions {
		margin-top: 0.75rem;
	}
	.label-like {
		display: block;
		font-weight: 700;
		font-size: 0.92em;
		margin-bottom: 0.35rem;
	}
	.query-editor {
		margin: 0.5rem 0;
	}
	.query-editor :global(.jsoneditor) {
		height: 12rem;
	}
</style>
