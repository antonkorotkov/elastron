<script>
	import { buildToolRequest, describeToolCall, formatRequestLine, isDestructiveCall } from '../../ai/catalog.js'
	import { toolLabel, toolNameOf, prettyJson } from './format.js'

	/**
	 * A write the assistant wants to make. Shows the exact request, built from
	 * the same catalog the server executes, and the user's approve/decline.
	 *
	 * `stale` means a later message followed this one. Approving from an older
	 * message can't run anything: the conversation has moved on, and the
	 * server drops unanswered approvals from earlier turns.
	 */
	let { part, onRespond = () => {}, inverted = false, stale = false } = $props()

	let name = $derived(toolNameOf(part))
	let request = $derived(buildToolRequest(name, part.input ?? {}))
	let destructive = $derived(isDestructiveCall(name, part.input ?? {}))
	let summary = $derived(describeToolCall(name, part.input ?? {}))
	let pending = $derived(part.state === 'approval-requested' && !stale)

	let outcome = $derived.by(() => {
		switch (part.state) {
			case 'approval-requested':
				return stale ? 'Expired without an answer. Ask again to run it.' : ''
			case 'approval-responded':
				if (stale) return part.approval?.approved ? 'Not run: the conversation moved on before it could.' : 'Declined.'
				return part.approval?.approved ? 'Approved. Running…' : 'Declined.'
			case 'output-available':
				return 'Approved and done.'
			case 'output-denied':
				return 'Declined.'
			case 'output-error':
				return `Failed: ${part.errorText}`
			default:
				return ''
		}
	})
</script>

<div
	class="approval-card"
	class:destructive
	class:pending
	role="group"
	aria-label="{toolLabel(name)} approval"
>
	<div class="card-title">
		<i class="icon" class:exclamation={destructive} class:triangle={destructive} class:shield={!destructive}></i>
		{toolLabel(name)}
	</div>
	{#if summary}
		<p class="summary">{summary}</p>
	{/if}
	{#if request}
		<code class="request-line">{formatRequestLine(request)}</code>
		{#if request.body !== undefined}
			<pre class="request-body">{prettyJson(request.body)}</pre>
		{/if}
		{#if request.headers}
			<pre class="request-body">{prettyJson({ headers: request.headers })}</pre>
		{/if}
	{/if}
	{#if destructive && pending}
		<p class="warning">This cannot be undone.</p>
	{/if}

	{#if pending}
		<div class="actions">
			<button
				type="button"
				class="ui tiny button"
				class:red={destructive}
				class:green={!destructive}
				onclick={() => onRespond(true)}
			>
				Approve
			</button>
			<button type="button" class="ui tiny basic button" class:inverted onclick={() => onRespond(false)}>
				Decline
			</button>
		</div>
	{:else if outcome}
		<p class="outcome" class:failed={part.state === 'output-error'}>{outcome}</p>
	{/if}
</div>

<style>
	.approval-card {
		margin: 0.5em 0;
		padding: 0.75em;
		border: 1px solid var(--assistant-border, rgba(34, 36, 38, 0.2));
		border-left: 4px solid #2185d0;
		border-radius: 4px;
	}
	.approval-card.destructive {
		border-left-color: #db2828;
	}
	.card-title {
		font-weight: 700;
		margin-bottom: 0.4em;
	}
	.summary {
		margin: 0 0 0.4em;
	}
	.request-line {
		display: block;
		font-size: 0.85em;
		word-break: break-all;
	}
	.request-body {
		margin: 0.4em 0 0;
		max-height: 12em;
		overflow: auto;
		font-size: 0.8em;
		padding: 0.5em;
		background: var(--assistant-code-bg, rgba(0, 0, 0, 0.05));
		border-radius: 3px;
	}
	.warning {
		margin: 0.5em 0 0;
		color: var(--assistant-danger, #db2828);
		font-weight: 600;
	}
	.actions {
		margin-top: 0.6em;
	}
	.outcome {
		margin: 0.5em 0 0;
		opacity: 0.8;
	}
	.outcome.failed {
		color: var(--assistant-danger, #db2828);
		opacity: 1;
	}
</style>
