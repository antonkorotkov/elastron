<script>
	import { useStoreon } from '@storeon/svelte'
	import { isThemeToggleChecked } from '../../../utils/helpers'
	import {
		AI_PROVIDERS,
		AI_PROVIDER_LABELS,
		normalizeAiSettings,
	} from '../../../store/aiSettings.js'

	const { dispatch, aiSettings, app } = useStoreon('aiSettings', 'app')

	const MODEL_PLACEHOLDERS = {
		openai: 'e.g. gpt-5.1',
		anthropic: 'e.g. claude-opus-5',
		google: 'e.g. gemini-3-pro',
		custom: 'e.g. llama3.1',
	}

	// Edits go to a draft; nothing reaches the store until the dialog saves.
	let draft = $state(normalizeAiSettings(JSON.parse(JSON.stringify($aiSettings))))

	/** Called by the Settings dialog's Save button. */
	export const save = () => dispatch('aiSettings/save', $state.snapshot(draft))

	let inverted = $derived(isThemeToggleChecked($app.theme))
</script>

<form class="ui form" class:inverted onsubmit={e => e.preventDefault()}>
	<div class="field">
		<label for="ai-active-provider">Active provider</label>
		<select
			id="ai-active-provider"
			class="ui dropdown"
			value={draft.activeProvider ?? ''}
			onchange={event => (draft.activeProvider = event.target.value || null)}
		>
			<option value="">None</option>
			{#each AI_PROVIDERS as provider (provider)}
				<option value={provider}>{AI_PROVIDER_LABELS[provider]}</option>
			{/each}
		</select>
		<p class="hint" class:inverted>
			The assistant uses only the active provider. Keys stored for the others are
			kept. Keys are stored encrypted on this machine and sent only to their provider.
		</p>
	</div>

	{#each AI_PROVIDERS as provider (provider)}
		{@const config = draft.providers[provider]}
		<h4
			class="ui dividing header provider-header"
			class:inverted
			class:active-provider={provider === draft.activeProvider}
		>
			{AI_PROVIDER_LABELS[provider]}
			{#if provider === draft.activeProvider}
				<span class="ui mini green label">Active</span>
			{/if}
		</h4>

		{#if provider === 'custom'}
			<div class="field">
				<label for="ai-{provider}-base-url">Base URL</label>
				<input
					id="ai-{provider}-base-url"
					type="url"
					placeholder="e.g. http://localhost:11434/v1"
					autocomplete="off"
					spellcheck="false"
					bind:value={config.baseUrl}
				/>
			</div>
		{/if}

		<div class="two fields">
			<div class="field">
				<label for="ai-{provider}-api-key">API key</label>
				<input
					id="ai-{provider}-api-key"
					type="password"
					autocomplete="off"
					spellcheck="false"
					bind:value={config.apiKey}
				/>
			</div>
			<div class="field">
				<label for="ai-{provider}-model">Model</label>
				<input
					id="ai-{provider}-model"
					type="text"
					placeholder={MODEL_PLACEHOLDERS[provider]}
					autocomplete="off"
					spellcheck="false"
					bind:value={config.model}
				/>
			</div>
		</div>
	{/each}
</form>

<style>
	.hint {
		margin-top: 0.4em;
		opacity: 0.7;
		font-size: 0.9em;
	}
	/* Semantic's inverted form recolors labels, not plain text. */
	.hint.inverted {
		color: rgba(255, 255, 255, 0.9);
	}
	.provider-header {
		margin-top: 1.5em !important;
	}
	.provider-header .label {
		margin-left: 0.5em;
		vertical-align: middle;
	}
</style>
