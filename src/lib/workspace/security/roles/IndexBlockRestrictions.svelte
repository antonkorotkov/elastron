<script>
	import { useStoreon } from '@storeon/svelte'
	import { isThemeToggleChecked } from '$lib/utils/helpers'
	import JsonEditor from '$lib/components/JsonEditor.svelte'
	import API from '$lib/api/elasticsearch'
	import { CAUSE, classifySecurityError } from '$lib/security/causes.js'
	import {
		QUERY_FORM,
		readFieldSecurity,
		readQuery,
		refuseFieldSecurity,
		writeFieldSecurity,
		writeQuery,
	} from './blockQuery.js'
	import { parseList } from './roleModel.js'

	let { block = {}, readOnly = false, index = 0, onChange = () => {}, onEditorChange = () => {} } =
		$props()

	const { app, connection } = useStoreon('app', 'connection')
	let inverted = $derived(isThemeToggleChecked($app.theme))

	let query = $derived(readQuery(block))
	let fieldSecurity = $derived(readFieldSecurity(block))
	let hasQuery = $derived(query.form !== QUERY_FORM.NONE)
	let fieldRefusal = $derived(refuseFieldSecurity(fieldSecurity))

	const count = n => Number(n ?? 0).toLocaleString()

	let editor = $state(null)
	let editorError = $state('')
	let preview = $state(null)
	let previewing = $state(false)

	$effect(() => {
		onEditorChange(index, editor)
		return () => onEditorChange(index, null)
	})

	const setForm = form => {
		preview = null
		editorError = ''
		onChange({
			query: writeQuery({ form, source: query.source ?? { match_all: {} } }),
		})
	}

	const setFields = next => onChange({ field_security: writeFieldSecurity(next) })

	const runPreview = async () => {
		previewing = true
		preview = null
		try {
			const source = editor ? editor.get() : query.source
			preview = await new API($connection).previewSecurityQuery(block.names || [], source)
		} catch (err) {
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
		{#if query.unmodelled}
			<span class="ui grey text">
				This block's query is stored in a form this editor cannot show, such as a
				template. It is kept exactly as it is; change it in the JSON view.
			</span>
		{:else}
			<div class="ui tiny basic buttons" class:inverted>
				<button type="button" class="ui button" class:active={!hasQuery} disabled={readOnly} onclick={() => setForm(QUERY_FORM.NONE)}>
					None
				</button>
				<button type="button" class="ui button" class:active={hasQuery} disabled={readOnly} onclick={() => setForm(QUERY_FORM.QUERY)}>
					Query
				</button>
			</div>

			{#if hasQuery}
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
					<div class="preview">
						<button type="button" class="ui tiny basic button" class:inverted class:loading={previewing} onclick={runPreview}>
							<i class="eye icon"></i> What does this match?
						</button>

						{#if preview?.noPatterns}
							<span class="result muted">Give this block an index pattern first.</span>
						{:else if preview?.unavailable}
							<span class="result muted">
								This account cannot read these indices. The role can still be saved.
							</span>
						{:else if preview?.failed}
							<span class="result muted">{preview.failed}</span>
						{:else if preview}
							<span class="result" class:none={preview.matching === 0}>
								<i class="{preview.matching === 0 ? 'exclamation triangle yellow' : 'check circle green'} icon"></i>
								<b>{count(preview.matching)}</b>
								of {count(preview.total)} documents
								{#if preview.matching === 0}
									— this role would see nothing here
								{/if}
							</span>
						{/if}
					</div>
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
				oninput={e => setFields({ ...fieldSecurity, grant: parseList(e.target.value) })}
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
				oninput={e => setFields({ ...fieldSecurity, except: parseList(e.target.value) })}
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
	.preview {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.6rem;
	}
	.result {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		font-size: 0.92em;
	}
	.result :global(i.icon) {
		margin: 0;
	}
	.result.muted {
		opacity: 0.7;
	}
</style>
