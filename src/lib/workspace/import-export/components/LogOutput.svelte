<script>
	import { useStoreon } from '@storeon/svelte'

	import { isThemeToggleChecked } from '../../../utils/helpers'

	let div
	let autoscroll = $derived(div && div.offsetHeight + div.scrollTop > div.scrollHeight - 20);

	const { dispatch, app, importExport } = useStoreon('app', 'importExport')

	let inverted = $derived(isThemeToggleChecked($app.theme))

	let filteredLogs = $derived($importExport.logs.filter(item =>
		$importExport.logFilter.includes(item.type)
	))

	let logsToShow = $derived(filteredLogs.slice(
		-Math.abs($importExport.logsPerPage * $importExport.logsShowPages)
	))

	$effect(() => {
		if (logsToShow && autoscroll) div.scrollTo(0, div.scrollHeight)
	})
</script>

{#if filteredLogs.length > logsToShow.length}
	<div class="ui grid">
		<div class="sixteen wide column center aligned">
			<a
				class="ui primary button basic mini"
				class:inverted
				href
				onclick={() => dispatch('ie/logsShowMore')}>Show more</a
			>
		</div>
	</div>
{/if}

<div class="ui divided selection list" class:inverted bind:this={div}>
	{#if logsToShow.length}
		{#each logsToShow as log (log.id)}
			<a class="item" href>
				<div
					class="ui horizontal label"
					class:red={log.type === 'error'}
					class:blue={log.type === 'info'}
					class:yellow={log.type === 'verbose'}
				>
					{log.type}
				</div>
				{log.message}
			</a>
		{/each}
	{:else}
		Log is empty
	{/if}
</div>

<style>
	.ui.list {
		max-height: 75vh;
		overflow-y: auto;
	}
	.ui.list .label {
		min-width: 6em;
	}
	.ui.list .item {
		word-wrap: break-word;
	}
</style>
