<script>
	import { useStoreon } from '@storeon/svelte'
	import { tick } from 'svelte'

	import { tabTitle } from '../../store/search'
	import { isThemeToggleChecked } from '../../utils/helpers'

	const { dispatch, search, app } = useStoreon('search', 'app')

	let inverted = $derived(isThemeToggleChecked($app.theme))

	let bar = $state()

	// Tabs never wrap, so a newly added or restored active tab can sit past
	// the right edge. Bring it into view whenever the active tab changes.
	$effect(() => {
		void $search.activeId
		const active = bar
			?.querySelector('[role="tab"][aria-selected="true"]')
			?.closest('.item')
		// The add control sits right after the last tab; revealing it keeps
		// the last tab in view too, and leaves the user a way to add another.
		const target = active?.nextElementSibling?.classList.contains('add')
			? active.nextElementSibling
			: active
		if (typeof target?.scrollIntoView === 'function') {
			target.scrollIntoView({ block: 'nearest', inline: 'nearest' })
		}
	})

	// A mouse wheel only scrolls vertically; the bar only scrolls sideways.
	const onWheel = event => {
		if (bar && event.deltaY && !event.deltaX) bar.scrollLeft += event.deltaY
	}

	// Id of the tab whose title is being edited, and the draft text.
	let renamingId = $state(null)
	let draft = $state('')
	let input = $state()

	const startRename = async tab => {
		renamingId = tab.id
		draft = tab.title ?? ''
		await tick()
		input?.focus()
		input?.select()
	}

	const commitRename = () => {
		if (renamingId === null) return
		dispatch('search/tabs/rename', { id: renamingId, title: draft })
		renamingId = null
	}

	const cancelRename = () => {
		renamingId = null
	}

	const onRenameKey = event => {
		if (event.key === 'Enter') commitRename()
		else if (event.key === 'Escape') cancelRename()
	}
</script>

<div
	class="ui pointing secondary menu search-tabs"
	class:inverted
	role="tablist"
	bind:this={bar}
	onwheel={onWheel}
>
	{#each $search.tabs as tab (tab.id)}
		{@const active = tab.id === $search.activeId}
		<div class="item" class:active role="presentation">
			{#if renamingId === tab.id}
				<input
					class="rename"
					bind:this={input}
					bind:value={draft}
					placeholder={tab.index}
					onkeydown={onRenameKey}
					onblur={commitRename}
					aria-label="Tab name"
				/>
			{:else}
				<button
					type="button"
					class="tab-title"
					role="tab"
					aria-selected={active}
					title={tab.title ? `${tab.title} (${tab.index})` : tab.index}
					onclick={() => dispatch('search/tabs/switch', tab.id)}
					ondblclick={() => startRename(tab)}
				>
					{#if tab.loading}
						<i class="spinner loading icon" aria-label="Running"></i>
					{/if}
					{tabTitle(tab)}
				</button>
			{/if}
			<button
				type="button"
				class="tab-close"
				aria-label="Close tab {tabTitle(tab)}"
				title="Close tab"
				onclick={() => dispatch('search/tabs/close', tab.id)}
			>
				<i class="close icon"></i>
			</button>
		</div>
	{/each}
	<div class="item add" role="presentation">
		<button
			type="button"
			class="tab-add"
			aria-label="New tab"
			title="New tab"
			onclick={() => dispatch('search/tabs/add')}
		>
			<i class="plus icon"></i>
		</button>
	</div>
</div>

<style>
	/* One row, always: the search view reserves a fixed height for this bar.
	   Overflow scrolls sideways with a thin scrollbar as the affordance. */
	.search-tabs {
		margin-top: 0 !important;
		margin-bottom: 0.5rem !important;
		flex-wrap: nowrap;
		overflow-x: auto;
		overflow-y: hidden;
		/* No track: it overlaid the tabs. Wheel, trackpad and the scroll-
		   into-view on activation still move the bar. */
		scrollbar-width: none;
		/* Semantic draws the active underline with a negative bottom margin
		   that a scroll box clips. The baseline moves to an inset shadow on
		   the box itself, which neither scrolls nor clips the underline. */
		border-bottom: 0 !important;
		box-shadow: inset 0 -2px 0 rgba(34, 36, 38, 0.15);
	}

	.search-tabs.inverted {
		box-shadow: inset 0 -2px 0 rgba(255, 255, 255, 0.1);
	}

	.search-tabs .item {
		display: flex;
		align-items: center;
		flex: 0 0 auto;
		gap: 0.25rem;
		margin-bottom: 0 !important;
		padding: 0.6em 0.5em 0.6em 0.9em !important;
	}

	.search-tabs .item.add {
		padding: 0.6em 0.7em !important;
	}

	.tab-title,
	.tab-close,
	.tab-add {
		background: none;
		border: none;
		padding: 0;
		margin: 0;
		font: inherit;
		color: inherit;
		cursor: pointer;
		display: inline-flex;
		align-items: center;
		gap: 0.35em;
		max-width: 14rem;
	}

	/* The title and the rename input share one line box, so swapping them
	   cannot move anything. 18px clears the smallest box Chromium gives a
	   text input; the 2px side padding matches the caret room it reserves. */
	.tab-title,
	.rename {
		box-sizing: border-box;
		height: 18px;
		line-height: 18px;
	}

	.tab-title {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		display: block;
		padding: 0 2px;
	}

	.tab-close,
	.tab-add {
		opacity: 0.45;
		line-height: 1;
	}

	.tab-close :global(.icon),
	.tab-add :global(.icon) {
		margin: 0;
	}

	.item:hover .tab-close,
	.tab-close:hover,
	.tab-add:hover {
		opacity: 1;
	}

	/* Sits in the title's exact box so the tab does not jump when editing
	   starts: same font, no padding or border, width following the text. The
	   underline is the only cue that the title is now editable. */
	.rename {
		font: inherit;
		color: inherit;
		background: transparent;
		border: none;
		border-bottom: 1px solid currentColor;
		border-radius: 0;
		outline: none;
		padding: 0;
		margin: 0;
		min-width: 3ch;
		max-width: 14rem;
		field-sizing: content;
	}

	.rename::placeholder {
		color: inherit;
		opacity: 0.5;
	}
</style>
