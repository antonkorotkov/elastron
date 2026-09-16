<script>
	import { needsConfirmation } from '../../ai/catalog.js'
	import { toolLabel, toolNameOf, prettyJson, isInvalidInputError } from './format.js'
	import ApprovalCard from './ApprovalCard.svelte'
	import QueryCard from './QueryCard.svelte'

	let { part, onRespond = () => {}, handoff = {}, inverted = false, stale = false } = $props()

	let name = $derived(toolNameOf(part))
	let running = $derived(part.state === 'input-streaming' || part.state === 'input-available')
	// Writes always go through approval; a read can too, such as a later page.
	let approvalFlow = $derived(
		!running &&
			(needsConfirmation(name) ||
				part.approval != null ||
				part.state === 'approval-requested' ||
				part.state === 'output-denied')
	)
</script>

{#if isInvalidInputError(part)}
	<!-- The model's input was rejected and sent back for it to fix; muted, not an alarm. -->
	<details class="tool-line rejected">
		<summary><i class="redo icon"></i> {toolLabel(name)}: invalid request, sent back to the assistant</summary>
		<p class="error-text">{part.errorText}</p>
	</details>
{:else if name === 'propose-query'}
	{#if part.state === 'output-available'}
		<QueryCard proposal={part.output} {...handoff} {inverted} />
	{:else if part.state === 'output-error'}
		<p class="tool-line failed"><i class="times icon"></i> Could not prepare the query: {part.errorText}</p>
	{:else}
		<p class="tool-line"><i class="notched circle loading icon"></i> Preparing a query…</p>
	{/if}
{:else if approvalFlow}
	<ApprovalCard {part} {inverted} {stale} onRespond={approved => onRespond(part, approved)} />
{:else}
	<details class="tool-line" class:failed={part.state === 'output-error'}>
		<summary>
			{#if running}
				<i class="notched circle loading icon"></i>
			{:else if part.state === 'output-error'}
				<i class="times icon"></i>
			{:else}
				<i class="check icon"></i>
			{/if}
			{toolLabel(name)}{part.input?.index ? ` · ${part.input.index}` : ''}
			{#if part.output?.truncated}
				<span class="truncated">partial</span>
			{/if}
		</summary>
		{#if part.state === 'output-error'}
			<p class="error-text">{part.errorText}</p>
		{/if}
		{#if part.input && Object.keys(part.input).length}
			<pre>{prettyJson(part.input)}</pre>
		{/if}
		{#if part.state === 'output-available'}
			<pre>{prettyJson(part.output)}</pre>
		{/if}
	</details>
{/if}

<style>
	.tool-line {
		margin: 0.3em 0;
		font-size: 0.9em;
		opacity: 0.85;
	}
	.tool-line summary {
		cursor: pointer;
	}
	.tool-line.rejected {
		opacity: 0.6;
	}
	.tool-line.rejected .error-text {
		font-size: 0.85em;
		word-break: break-word;
	}
	.tool-line.failed {
		color: var(--assistant-danger, #db2828);
		opacity: 1;
	}
	.tool-line pre {
		max-height: 14em;
		overflow: auto;
		font-size: 0.8em;
		padding: 0.5em;
		background: var(--assistant-code-bg, rgba(0, 0, 0, 0.05));
		border-radius: 3px;
	}
	.truncated {
		margin-left: 0.4em;
		font-size: 0.8em;
		padding: 0 0.4em;
		border-radius: 3px;
		background: #fbbd08;
		color: #000;
	}
	.error-text {
		margin: 0.3em 0;
	}
</style>
