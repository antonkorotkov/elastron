<script>
	import { useStoreon } from '@storeon/svelte'
	import { isThemeToggleChecked } from '$lib/utils/helpers'

	const { app, monitoring } = useStoreon('app', 'monitoring')

	let inverted = $derived(isThemeToggleChecked($app.theme))
	let health = $derived($monitoring.clusterHealth)
	let stats = $derived($monitoring.clusterStats)

	const formatBytes = (bytes) => {
		if (bytes == null || isNaN(bytes)) return '—'
		const units = ['B', 'KB', 'MB', 'GB', 'TB']
		let i = 0
		let value = bytes
		while (value >= 1024 && i < units.length - 1) {
			value /= 1024
			i++
		}
		return `${value.toFixed(1)} ${units[i]}`
	}

	const formatNumber = (num) => {
		if (num == null || isNaN(num)) return '—'
		return Number(num).toLocaleString()
	}

	const getProgressColor = (percent) => {
		const val = Number(percent)
		if (isNaN(val)) return '#8b949e'
		if (val < 70) return '#2ea043' // Green
		if (val < 85) return '#dbab09' // Yellow
		return '#d73a49' // Red
	}

	let fsUsed = $derived(
		stats?.nodes?.fs?.total_in_bytes && stats?.nodes?.fs?.available_in_bytes
			? stats.nodes.fs.total_in_bytes - stats.nodes.fs.available_in_bytes
			: null
	)
	let fsTotal = $derived(stats?.nodes?.fs?.total_in_bytes)
	let fsPercent = $derived(fsUsed && fsTotal ? Math.round((fsUsed / fsTotal) * 100) : 0)

	let jvmUsed = $derived(stats?.nodes?.jvm?.mem?.heap_used_in_bytes)
	let jvmMax = $derived(stats?.nodes?.jvm?.mem?.heap_max_in_bytes)
	let jvmPercent = $derived(jvmUsed && jvmMax ? Math.round((jvmUsed / jvmMax) * 100) : 0)

	let cpuPercent = $derived(stats?.nodes?.process?.cpu?.percent || 0)
	let osMemPercent = $derived(stats?.nodes?.os?.mem?.used_percent || 0)

	const healthColors = {
		green: '#2ea043',
		yellow: '#dbab09',
		red: '#d73a49',
	}
</script>

<div class="overview-dashboard" class:dark={inverted}>
	{#if health}
		<!-- Health & Cluster Name -->
		<div class="panel panel-health span-4">
			<div class="health-status">
				<div class="pulse-container">
					<div class="pulse-dot" style:background={healthColors[health.status] || '#8b949e'}></div>
					<div class="pulse-ring" style:border-color={healthColors[health.status] || '#8b949e'}></div>
				</div>
				<div>
					<div class="cluster-name">{health.cluster_name || 'Unknown cluster'}</div>
					<div class="cluster-badge" style:color={healthColors[health.status] || '#8b949e'}>
						{health.status?.toUpperCase() || 'UNKNOWN'} HEALTH
					</div>
				</div>
			</div>
		</div>

		<!-- Key Counts -->
		<div class="panel panel-stat">
			<div class="stat-icon" style="color: #a333c8; background: rgba(163, 51, 200, 0.1);"><i class="server icon"></i></div>
			<div class="stat-content">
				<div class="stat-value">{formatNumber(health.number_of_nodes)}</div>
				<div class="stat-label">Nodes</div>
			</div>
		</div>
		<div class="panel panel-stat">
			<div class="stat-icon" style="color: #2185d0; background: rgba(33, 133, 208, 0.1);"><i class="cubes icon"></i></div>
			<div class="stat-content">
				<div class="stat-value">{formatNumber(health.active_shards)}</div>
				<div class="stat-label">Active Shards</div>
			</div>
		</div>
		<div class="panel panel-stat">
			<div class="stat-icon" style="color: #00b5ad; background: rgba(0, 181, 173, 0.1);"><i class="database icon"></i></div>
			<div class="stat-content">
				<div class="stat-value">{formatNumber(stats?.indices?.count)}</div>
				<div class="stat-label">Indices</div>
			</div>
		</div>
		<div class="panel panel-stat">
			<div class="stat-icon" style="color: #f2711c; background: rgba(242, 113, 28, 0.1);"><i class="file alternate outline icon"></i></div>
			<div class="stat-content">
				<div class="stat-value">{formatNumber(stats?.indices?.docs?.count)}</div>
				<div class="stat-label">Documents</div>
			</div>
		</div>

		<!-- Resources First Row -->
		<div class="panel panel-resource span-2">
			<div class="resource-header">
				<div class="stat-label">JVM Heap Used</div>
				<div class="resource-value">
					{formatBytes(stats?.nodes?.jvm?.mem?.heap_used_in_bytes)}
					<span class="of-total">/ {formatBytes(stats?.nodes?.jvm?.mem?.heap_max_in_bytes)}</span>
				</div>
			</div>
			<div class="progress-track">
				<div class="progress-fill" style:width="{jvmPercent}%" style:background={getProgressColor(jvmPercent)}></div>
			</div>
			<div class="progress-percent">{jvmPercent}% Utilization</div>
		</div>

		<div class="panel panel-resource span-2">
			<div class="resource-header">
				<div class="stat-label">Filesystem Used</div>
				<div class="resource-value">
					{formatBytes(fsUsed)}
					<span class="of-total">/ {formatBytes(fsTotal)}</span>
				</div>
			</div>
			<div class="progress-track">
				<div class="progress-fill" style:width="{fsPercent}%" style:background={getProgressColor(fsPercent)}></div>
			</div>
			<div class="progress-percent">{fsPercent}% Utilization</div>
		</div>

		<div class="panel panel-resource span-2">
			<div class="resource-header">
				<div class="stat-label">OS Memory Used</div>
				<div class="resource-value">
					{stats?.nodes?.os?.mem?.used_percent != null ? stats.nodes.os.mem.used_percent + '%' : '—'}
				</div>
			</div>
			<div class="progress-track">
				<div class="progress-fill" style:width="{osMemPercent}%" style:background={getProgressColor(osMemPercent)}></div>
			</div>
			<div class="progress-percent">{osMemPercent}% Utilization</div>
		</div>

		<div class="panel panel-stat span-1">
			<div class="stat-icon" style="color: #6435c9; background: rgba(100, 53, 201, 0.1);"><i class="microchip icon"></i></div>
			<div class="stat-content">
				<div class="stat-value">{cpuPercent}%</div>
				<div class="stat-label">Process CPU</div>
			</div>
		</div>

		<div class="panel panel-stat span-1">
			<div class="stat-icon" style="color: #e03997; background: rgba(224, 57, 151, 0.1);"><i class="hdd outline icon"></i></div>
			<div class="stat-content">
				<div class="stat-value">{formatBytes(stats?.indices?.store?.size_in_bytes)}</div>
				<div class="stat-label">Store Size</div>
			</div>
		</div>

	{:else}
		<div class="panel span-4" style="justify-content: center; align-items: center; height: 300px; border-style: dashed;">
			<div class="ui active loader"></div>
			<span style="margin-top: 3rem; font-weight: 600; color: #6a737d;">Fetching cluster metrics...</span>
		</div>
	{/if}
</div>

<style>
	.overview-dashboard {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 1.5rem;
		padding: 0.5rem 0 2rem 0;
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
		justify-content: center;
	}
	.panel:hover {
		transform: translateY(-2px);
		box-shadow: 0 8px 16px rgba(0,0,0,0.06);
		border-color: rgba(34, 36, 38, 0.15);
	}

	.overview-dashboard.dark .panel {
		background: #1e1e1e;
		border: 1px solid rgba(255, 255, 255, 0.08);
		box-shadow: 0 4px 12px rgba(0,0,0,0.2);
	}
	.overview-dashboard.dark .panel:hover {
		box-shadow: 0 8px 20px rgba(0,0,0,0.3);
		border-color: rgba(255, 255, 255, 0.15);
	}

	.span-2 { grid-column: span 2; }
	.span-4 { grid-column: span 4; }

	/* Health Panel */
	.panel-health {
		flex-direction: row;
		align-items: center;
		padding: 1.5rem 2rem;
	}

	.health-status {
		display: flex;
		align-items: center;
		gap: 1.5rem;
	}

	.pulse-container {
		position: relative;
		width: 16px;
		height: 16px;
	}
	.pulse-dot {
		width: 16px;
		height: 16px;
		border-radius: 50%;
		position: absolute;
		z-index: 2;
	}
	.pulse-ring {
		width: 16px;
		height: 16px;
		border-radius: 50%;
		position: absolute;
		z-index: 1;
		border: 2px solid;
		animation: pulse 2s cubic-bezier(0.2, 0.8, 0.2, 1) infinite;
	}
	@keyframes pulse {
		0% { transform: scale(1); opacity: 0.8; }
		100% { transform: scale(3.5); opacity: 0; }
	}

	.cluster-name {
		font-size: 1.5rem;
		font-weight: 700;
		color: #1e2022;
		margin-bottom: 0.2rem;
	}
	.overview-dashboard.dark .cluster-name { color: #f9fafb; }

	.cluster-badge {
		font-size: 0.75rem;
		font-weight: 800;
		letter-spacing: 0.08em;
	}

	/* Stat Panels */
	.panel-stat {
		flex-direction: row;
		align-items: center;
		gap: 1.25rem;
	}

	.stat-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 48px;
		height: 48px;
		border-radius: 12px;
		font-size: 1.5rem;
	}

	/* Prevent Semantic UI icon margins from messing up centering */
	.stat-icon :global(i.icon) {
		margin: 0 !important;
	}

	.stat-content {
		display: flex;
		flex-direction: column;
	}

	.stat-value {
		font-size: 1.8rem;
		font-weight: 700;
		color: #1e2022;
		line-height: 1.2;
	}
	.overview-dashboard.dark .stat-value { color: #f9fafb; }

	.stat-label {
		font-size: 0.8rem;
		font-weight: 600;
		color: #6a737d;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		margin-top: 0.2rem;
	}
	.overview-dashboard.dark .stat-label { color: #8b949e; }

	/* Resource Panels */
	.resource-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-end;
		margin-bottom: 1rem;
	}

	.resource-value {
		font-size: 1.2rem;
		font-weight: 700;
		color: #1e2022;
	}
	.overview-dashboard.dark .resource-value { color: #f9fafb; }

	.of-total {
		font-size: 0.85rem;
		font-weight: 500;
		color: #6a737d;
	}
	.overview-dashboard.dark .of-total { color: #8b949e; }

	.progress-track {
		height: 8px;
		background: #eaedf0;
		border-radius: 4px;
		overflow: hidden;
		margin-bottom: 0.6rem;
		position: relative;
	}
	.overview-dashboard.dark .progress-track {
		background: #30363d;
	}

	.progress-fill {
		height: 100%;
		border-radius: 4px;
		transition: width 0.8s cubic-bezier(0.2, 0.8, 0.2, 1);
		min-width: 4px;
	}

	.progress-percent {
		font-size: 0.8rem;
		font-weight: 600;
		color: #6a737d;
		text-align: right;
	}
	.overview-dashboard.dark .progress-percent { color: #8b949e; }

	/* Responsive */
	@media (max-width: 1100px) {
		.overview-dashboard {
			grid-template-columns: repeat(2, 1fr);
		}
		.span-4 { grid-column: span 2; }
	}

	@media (max-width: 700px) {
		.overview-dashboard {
			grid-template-columns: 1fr;
		}
		.span-4, .span-2 { grid-column: span 1; }
	}
</style>
