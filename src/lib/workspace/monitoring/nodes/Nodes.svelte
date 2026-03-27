<script>
	import { useStoreon } from '@storeon/svelte'
	import { isThemeToggleChecked } from '$lib/utils/helpers'
	import TimeSeriesChart from './TimeSeriesChart.svelte'

	const { app, monitoring } = useStoreon('app', 'monitoring')

	let isDark = $derived(isThemeToggleChecked($app.theme))
	let inverted = $derived(isDark)
	let nodeStats = $derived($monitoring.nodeStats)
	let timestamps = $derived(nodeStats.timestamps)
	let hasData = $derived(timestamps.length > 0)

	/**
	 * Extract a specific metric from all nodes into
	 * a { nodeName: number[] } map for the chart.
	 */
	const extractMetric = (series, metric) => {
		const result = {}
		for (const [nodeName, metrics] of Object.entries(series)) {
			result[nodeName] = metrics[metric]
		}
		return result
	}

	let cpuSeries = $derived(extractMetric(nodeStats.series, 'cpu'))
	let jvmHeapSeries = $derived(extractMetric(nodeStats.series, 'jvmHeap'))
	let osMemSeries = $derived(extractMetric(nodeStats.series, 'osMem'))
	let loadAvgSeries = $derived(extractMetric(nodeStats.series, 'loadAvg'))
</script>

<div class="nodes-dashboard" class:dark={isDark}>
	{#if hasData}
		<div class="chart-grid">
			<div class="panel">
				<TimeSeriesChart
					title="CPU Usage (%)"
					{timestamps}
					series={cpuSeries}
					unit="percent"
					{isDark}
				/>
			</div>
			<div class="panel">
				<TimeSeriesChart
					title="JVM Heap Usage (%)"
					{timestamps}
					series={jvmHeapSeries}
					unit="percent"
					{isDark}
				/>
			</div>
			<div class="panel">
				<TimeSeriesChart
					title="OS Memory Usage (%)"
					{timestamps}
					series={osMemSeries}
					unit="percent"
					{isDark}
				/>
			</div>
			<div class="panel">
				<TimeSeriesChart
					title="Load Average (1m)"
					{timestamps}
					series={loadAvgSeries}
					unit="number"
					{isDark}
				/>
			</div>
		</div>
	{:else}
		<div class="panel" style="justify-content: center; align-items: center; height: 300px; border-style: dashed;">
			<div class="ui active loader"></div>
			<span style="margin-top: 3rem; font-weight: 600; color: #6a737d;">Waiting for node metrics...</span>
		</div>
	{/if}
</div>

<style>
	.nodes-dashboard {
		padding: 0.5rem 0 2rem 0;
	}

	.chart-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 1.5rem;
	}

	.panel {
		background: #ffffff;
		border: 1px solid rgba(34, 36, 38, 0.1);
		border-radius: 12px;
		padding: 1.5rem;
		box-shadow: 0 2px 8px rgba(0,0,0,0.03);
		transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
		display: flex;
		flex-direction: column;
		min-width: 0; /* Allow grid item to shrink */
	}
	.panel:hover {
		transform: translateY(-2px);
		box-shadow: 0 8px 16px rgba(0,0,0,0.06);
		border-color: rgba(34, 36, 38, 0.15);
	}

	.nodes-dashboard.dark .panel {
		background: #1e1e1e;
		border: 1px solid rgba(255, 255, 255, 0.08);
		box-shadow: 0 4px 12px rgba(0,0,0,0.2);
	}
	.nodes-dashboard.dark .panel:hover {
		box-shadow: 0 8px 20px rgba(0,0,0,0.3);
		border-color: rgba(255, 255, 255, 0.15);
	}

	@media (max-width: 900px) {
		.chart-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
