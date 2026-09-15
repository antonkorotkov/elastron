<script>
	import { formatRequestLine } from '../../ai/catalog.js'
	import { prettyJson } from './format.js'

	/** A query the assistant built, with ways to take it into the app. */
	let {
		proposal,
		onOpenInSearch = () => {},
		onLoadInPlayground = () => {},
		onCopy = () => {},
		inverted = false,
	} = $props()

	let isSearch = $derived(proposal.kind === 'search')
</script>

<div class="query-card" role="group" aria-label="Proposed query">
	<div class="card-title">
		<i class="code icon"></i>
		{proposal.title || (isSearch ? `Search ${proposal.index}` : 'Proposed request')}
	</div>
	<code class="request-line">{formatRequestLine(proposal)}</code>
	{#if proposal.body !== undefined}
		<pre class="request-body">{prettyJson(proposal.body)}</pre>
	{/if}
	<div class="actions">
		{#if isSearch}
			<button type="button" class="ui tiny primary button" onclick={() => onOpenInSearch(proposal)}>
				<i class="search icon"></i> Open in Search
			</button>
		{/if}
		<button type="button" class="ui tiny button" class:inverted onclick={() => onLoadInPlayground(proposal)}>
			<i class="flask icon"></i> Load in Playground
		</button>
		<button type="button" class="ui tiny basic button" class:inverted onclick={() => onCopy(proposal)}>
			<i class="copy icon"></i> Copy
		</button>
	</div>
</div>

<style>
	.query-card {
		margin: 0.5em 0;
		padding: 0.75em;
		border: 1px solid var(--assistant-border, rgba(34, 36, 38, 0.2));
		border-left: 4px solid #21ba45;
		border-radius: 4px;
	}
	.card-title {
		font-weight: 700;
		margin-bottom: 0.4em;
	}
	.request-line {
		display: block;
		font-size: 0.85em;
		word-break: break-all;
	}
	.request-body {
		margin: 0.4em 0 0;
		max-height: 14em;
		overflow: auto;
		font-size: 0.8em;
		padding: 0.5em;
		background: var(--assistant-code-bg, rgba(0, 0, 0, 0.05));
		border-radius: 3px;
	}
	.actions {
		margin-top: 0.6em;
		display: flex;
		flex-wrap: wrap;
		gap: 0.3em;
	}
	.actions :global(.button) {
		margin: 0;
	}
</style>
