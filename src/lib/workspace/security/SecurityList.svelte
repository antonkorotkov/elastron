<script>
	import VirtualTable from '$lib/components/tables/VirtualTable.svelte'
	import SecurityUnavailable from './SecurityUnavailable.svelte'
	import { useStoreon } from '@storeon/svelte'
	import { isThemeToggleChecked } from '$lib/utils/helpers'

	// Decides between loading, empty and unavailable. A list that has not
	// resolved must not claim the cluster is empty, which is what the dashboard
	// tables do. Its roots sit directly in the caller's .ui.segments so the
	// table stays flush with the toolbar.
	let {
		columns,
		rows,
		sorting = [],
		Cell = null,
		onSort,
		loading = false,
		loaded = false,
		cause = null,
		message = '',
		reason = '',
		entity = 'these entries',
		emptyMessage = 'Nothing here',
		hasEntries = undefined,
		indicatorDelay = 200,
	} = $props()

	const { app } = useStoreon('app')
	let inverted = $derived(isThemeToggleChecked($app.theme))

	// Judging this on the filtered rows made a search matching nothing look
	// like an unavailable surface.
	let anyEntries = $derived(hasEntries ?? rows.length > 0)
	let hasRows = $derived(anyEntries)
	let firstLoad = $derived(loading && !hasRows)

	// A local cluster answers faster than the eye, so an immediate indicator
	// would only flash.
	let showIndicator = $state(false)
	$effect(() => {
		if (!firstLoad) {
			showIndicator = false
			return
		}
		const timer = setTimeout(() => (showIndicator = true), indicatorDelay)
		return () => clearTimeout(timer)
	})

	let blocked = $derived(Boolean(cause) && !anyEntries)
</script>

{#if blocked}
	<div class="ui segment" class:inverted>
		<SecurityUnavailable {cause} {message} {reason} {entity} />
	</div>
{:else if firstLoad}
	<div class="ui segment loading-segment" class:inverted data-testid="security-list-loading">
		{#if showIndicator}
			<div class="ui active inline centered loader"></div>
			<p class="ui grey text">Loading {entity}…</p>
		{/if}
	</div>
{:else}
	<VirtualTable
		{columns}
		{rows}
		{sorting}
		{Cell}
		{onSort}
		selectable
		footerColumns
		emptyMessage={loaded ? emptyMessage : ''}
	/>
{/if}

<style>
	.loading-segment {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.75rem;
		min-height: 12rem;
	}
	.loading-segment p {
		margin: 0;
	}
</style>
