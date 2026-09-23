<script>
	import VirtualTable from '$lib/components/tables/VirtualTable.svelte'
	import SecurityUnavailable from './SecurityUnavailable.svelte'
	import { useStoreon } from '@storeon/svelte'
	import { isThemeToggleChecked } from '$lib/utils/helpers'

	/**
	 * The table for a security surface, and the one place that decides between
	 * "loading", "nothing here" and "could not load".
	 *
	 * A list that has not resolved yet must not claim the cluster is empty. The
	 * dashboard tables get this wrong today: they hand `VirtualTable` an empty
	 * row array during the initial fetch, so the table shows "No indices found"
	 * while the answer is still in flight. This exists so the security surfaces
	 * do not repeat that.
	 *
	 * Its root elements sit directly inside the caller's `.ui.segments`, the way
	 * `VirtualTable` does on the dashboard, so the table stays flush with the
	 * toolbar above it rather than gaining a segment's padding.
	 */
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
		/** How long a load may run before the indicator appears, in ms. */
		indicatorDelay = 200,
	} = $props()

	const { app } = useStoreon('app')
	let inverted = $derived(isThemeToggleChecked($app.theme))

	let hasRows = $derived(rows.length > 0)
	// A first load is one with nothing to show yet. A refresh keeps its rows.
	let firstLoad = $derived(loading && !hasRows)

	// An indicator that flashes for a few tens of milliseconds reads worse than
	// none, and a local cluster answers well inside that. It only appears once a
	// load has been outstanding past the delay.
	let showIndicator = $state(false)
	$effect(() => {
		if (!firstLoad) {
			showIndicator = false
			return
		}
		const timer = setTimeout(() => (showIndicator = true), indicatorDelay)
		return () => clearTimeout(timer)
	})

	// The failure replaces the table only when there is nothing to show. A
	// failed refresh leaves the rows alone; the store reports that one through
	// the notification tray rather than pushing a banner into the table.
	let blocked = $derived(Boolean(cause) && !hasRows)
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
