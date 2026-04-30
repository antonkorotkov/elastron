<script>
	import { onMount, onDestroy } from 'svelte'
	import { useStoreon } from '@storeon/svelte'
	import { isThemeToggleChecked } from '$lib/utils/helpers'
	import { INTERVALS } from '$lib/store/elasticsearch/monitoring'
	import MonitoringTabs from './MonitoringTabs.svelte'

	let { children } = $props()

	const { dispatch, app, monitoring } = useStoreon('app', 'monitoring')

	let inverted = $derived(isThemeToggleChecked($app.theme))
	let autoRefresh = $derived($monitoring.autoRefresh)
	let interval = $derived($monitoring.interval)
	let errorMessage = $derived($monitoring.errorMessage)
	let polling = $derived($monitoring.polling)

	const intervalLabels = {
		5000: '5s',
		10000: '10s',
		30000: '30s',
		60000: '1min',
	}

	const onAutoRefreshToggle = () => {
		dispatch('monitoring/config', {
			autoRefresh: !autoRefresh,
			interval,
		})
	}

	const onIntervalChange = e => {
		dispatch('monitoring/config', {
			autoRefresh,
			interval: Number(e.target.value),
		})
	}

	// Monitoring start/stop is now handled globally by the store's 'connected' event
	// to allow background data accumulation during navigation.
</script>

<MonitoringTabs>
	{#snippet rightContent()}
		<div class="monitoring-controls">
			{#if polling}
				<div class="live-indicator">
					<div class="ui active tiny inline loader"></div>
					<span class="live-text">LIVE</span>
				</div>
			{/if}
			<button
				class="control-pill refresh-btn"
				class:active={autoRefresh}
				class:dark={inverted}
				onclick={onAutoRefreshToggle}
				title={autoRefresh ? 'Pause auto-refresh' : 'Start auto-refresh'}
			>
				<i class={autoRefresh ? 'pause icon' : 'play icon'}></i>
				{autoRefresh ? 'Auto-refresh' : 'Paused'}
			</button>
			<div class="control-pill-group">
				<select
					class="control-pill interval-select"
					class:dark={inverted}
					value={interval}
					onchange={onIntervalChange}
					disabled={!autoRefresh}
				>
					{#each INTERVALS as ms (ms)}
						<option value={ms}>{intervalLabels[ms]}</option>
					{/each}
				</select>
			</div>
		</div>
	{/snippet}
</MonitoringTabs>

{#if errorMessage}
	<div class="ui warning message">
		<i class="warning sign icon"></i>
		{errorMessage}
	</div>
{/if}

{@render children?.()}

<style>
	.monitoring-controls {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		height: 100%;
		padding-bottom: 0.25rem;
	}

	.live-indicator {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-right: 0.5rem;
	}

	.live-text {
		font-size: 0.65rem;
		font-weight: 800;
		letter-spacing: 0.05em;
		color: #21ba45;
	}

	.control-pill {
		height: 32px;
		padding: 0 0.85rem;
		border: 1px solid rgba(34, 36, 38, 0.15);
		border-radius: 6px;
		background: #ffffff;
		font-size: 0.85rem;
		font-weight: 500;
		color: #444;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		cursor: pointer;
		transition: all 0.2s ease;
		outline: none;
	}

	.refresh-btn:hover {
		background: #f9fafb;
		border-color: rgba(34, 36, 38, 0.25);
	}

	.refresh-btn.active {
		background: #e7f5ec;
		border-color: #21ba45;
		color: #1a6d2f;
	}
	.refresh-btn.active:hover {
		background: #dcf2e4;
	}

	.interval-select {
		appearance: none;
		-webkit-appearance: none;
		padding-right: 1.5rem;
		background-image: url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22currentColor%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E');
		background-repeat: no-repeat;
		background-position: right 0.5rem center;
		min-width: 4rem;
	}

	.control-pill:disabled {
		opacity: 0.5;
		cursor: not-allowed;
		background: #f3f3f3;
	}

	/* Dark mode overrides */
	.control-pill.dark {
		background: #2d2d2d;
		border-color: rgba(255, 255, 255, 0.15);
		color: rgba(255, 255, 255, 0.9);
	}
	.refresh-btn.dark:hover {
		background: #363636;
	}
	.refresh-btn.active.dark {
		background: rgba(33, 186, 69, 0.15);
		border-color: #21ba45;
		color: #21ba45;
	}
	.refresh-btn.active.dark:hover {
		background: rgba(33, 186, 69, 0.2);
	}

	.interval-select.dark {
		background-image: url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22rgba(255,255,255,0.7)%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E');
		background-repeat: no-repeat;
		background-position: right 0.5rem center;
	}
</style>
