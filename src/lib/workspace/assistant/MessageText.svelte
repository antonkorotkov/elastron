<script>
	import { renderMarkdown } from './markdown.js'

	let { text = '' } = $props()

	// Sanitized in renderMarkdown; see markdown.js for why this is safe.
	let html = $derived(renderMarkdown(text))
</script>

<div class="markdown">
	<!-- eslint-disable-next-line svelte/no-at-html-tags -- escaped by markdown-it (html: false) and sanitized by DOMPurify in renderMarkdown -->
	{@html html}
</div>

<style>
	.markdown {
		word-break: break-word;
		line-height: 1.45;
	}
	.markdown :global(p) {
		margin: 0 0 0.5em;
	}
	.markdown :global(> :last-child) {
		margin-bottom: 0;
	}
	.markdown :global(h1),
	.markdown :global(h2),
	.markdown :global(h3),
	.markdown :global(h4),
	.markdown :global(h5),
	.markdown :global(h6) {
		margin: 0.8em 0 0.4em;
		line-height: 1.25;
		color: inherit;
	}
	.markdown :global(h1) {
		font-size: 1.25em;
	}
	.markdown :global(h2) {
		font-size: 1.15em;
	}
	.markdown :global(h3),
	.markdown :global(h4),
	.markdown :global(h5),
	.markdown :global(h6) {
		font-size: 1em;
	}
	.markdown :global(> :first-child) {
		margin-top: 0;
	}
	.markdown :global(ul),
	.markdown :global(ol) {
		margin: 0.3em 0 0.6em;
		padding-left: 1.4em;
	}
	.markdown :global(li) {
		margin: 0.15em 0;
	}
	.markdown :global(code) {
		font-size: 0.85em;
		padding: 0.1em 0.35em;
		border-radius: 3px;
		background: var(--assistant-code-bg, rgba(0, 0, 0, 0.06));
	}
	.markdown :global(pre) {
		margin: 0.4em 0 0.6em;
		padding: 0.6em 0.75em;
		border-radius: 4px;
		background: var(--assistant-code-bg, rgba(0, 0, 0, 0.06));
		overflow-x: auto;
		font-size: 0.85em;
	}
	.markdown :global(pre code) {
		padding: 0;
		background: none;
		font-size: inherit;
	}
	.markdown :global(table) {
		display: block;
		max-width: 100%;
		overflow-x: auto;
		border-collapse: collapse;
		margin: 0.4em 0 0.6em;
		font-size: 0.9em;
	}
	.markdown :global(th),
	.markdown :global(td) {
		border: 1px solid var(--assistant-border, rgba(34, 36, 38, 0.15));
		padding: 0.3em 0.5em;
		text-align: left;
	}
	.markdown :global(th) {
		background: var(--assistant-code-bg, rgba(0, 0, 0, 0.06));
	}
	.markdown :global(blockquote) {
		margin: 0.4em 0;
		padding-left: 0.8em;
		border-left: 3px solid var(--assistant-border, rgba(34, 36, 38, 0.15));
		opacity: 0.85;
	}
	.markdown :global(hr) {
		border: none;
		border-top: 1px solid var(--assistant-border, rgba(34, 36, 38, 0.15));
		margin: 0.8em 0;
	}
	.markdown :global(a) {
		color: var(--assistant-link, #4183c4);
	}
</style>
