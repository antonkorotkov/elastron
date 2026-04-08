<script>
	import { INTERVALS } from '$lib/store/elasticsearch/monitoring'

	let {
		loading,
		autoRefresh,
		interval,
		inverted,
		onRefresh,
		onAutoRefreshChange,
		onIntervalChange,
	} = $props()

	const intervalLabels = {
		5000: '5s',
		10000: '10s',
		30000: '30s',
		60000: '1min',
	}

	$effect(() => {
		let intervalId
		if (autoRefresh && interval) {
			intervalId = setInterval(() => {
				onRefresh()
			}, interval)
		}
		return () => {
			if (intervalId) clearInterval(intervalId)
		}
	})
</script>

<div class="ui tiny buttons">
	<button
		class="ui blue basic button"
		class:loading
		class:inverted
		onclick={onRefresh}
	>
		<i class="sync icon"></i> Refresh
	</button>
	<button
		class="ui blue basic button"
		class:orange={autoRefresh}
		class:inverted
		onclick={onAutoRefreshChange}
		title={autoRefresh ? 'Pause auto-refresh' : 'Start auto-refresh'}
	>
		<i class={autoRefresh ? 'pause icon' : 'play icon'}></i>
		Auto
	</button>
	{#if autoRefresh}
		<select
			class="ui orange basic button interval-select"
			class:inverted
			value={interval}
			onchange={onIntervalChange}
		>
			{#each INTERVALS as ms (ms)}
				<option value={ms}>{intervalLabels[ms]}</option>
			{/each}
		</select>
	{/if}
</div>

<style>
	.interval-select {
		appearance: none;
		-webkit-appearance: none;
		padding-right: 1.5rem !important;
		padding-top: 0.5em !important;
		padding-bottom: 0.5em !important;
		height: auto !important;
		line-height: 1 !important;
		background-image: url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22currentColor%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E');
		background-repeat: no-repeat;
		background-position: right 0.5rem center;
		border-left: 0 !important;
	}
	.interval-select.inverted {
		background-image: url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22rgba(255,255,255,0.7)%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E');
	}
	.interval-select:focus {
		outline: none;
	}
</style>
