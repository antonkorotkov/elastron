<script>
	import { onMount, onDestroy } from 'svelte'
	import uPlot from 'uplot'
	import 'uplot/dist/uPlot.min.css'

	/**
	 * @type {{ title: string, timestamps: number[], series: Record<string, number[]>, unit: 'percent' | 'number', isDark: boolean }}
	 */
	let { title, timestamps, series, unit = 'percent', isDark = false } = $props()

	const COLORS = [
		'#2185d0', // blue
		'#21ba45', // green
		'#f2711c', // orange
		'#a333c8', // purple
		'#e03997', // pink
		'#00b5ad', // teal
		'#db2828', // red
		'#fbbd08', // yellow
	]

	let containerEl = $state(null)
	let wrapperEl = $state(null)
	let chart = $state(null)
	let resizeObserver = null
	let isMouseOver = $state(false)

	const getThemeColors = dark => ({
		axes: dark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)',
		grid: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)',
		background: dark ? '#1b1c1d' : '#ffffff',
	})

	const tooltipPlugin = (unit, dark) => {
		let tooltip
		return {
			hooks: {
				init: u => {
					tooltip = document.createElement('div')
					tooltip.className = `u-tooltip ${dark ? 'dark' : ''}`
					if (wrapperEl) {
						// eslint-disable-next-line svelte/no-dom-manipulating
						wrapperEl.appendChild(tooltip)
					}
				},
				setCursor: u => {
					const { left, top, idx } = u.cursor

					if (idx == null) {
						tooltip.style.display = 'none'
						return
					}

					tooltip.style.display = 'block'

					const over = u.over
					const rect = over.getBoundingClientRect()
					const wrapRect = wrapperEl.getBoundingClientRect()

					const originX = rect.left - wrapRect.left
					const originY = rect.top - wrapRect.top

					// Differentiate between direct hover and synced hover.
					// If the mouse is NOT over this specific chart, it's a sync event.
					// In sync mode, we force the tooltip to a stable top position (originY + 10).
					// In hover mode, we follow the 'top' cursor position exactly.
					let posX = left + originX + 15
					let posY =
						isMouseOver && top !== null ? top + originY + 15 : originY + 10

					const time = new Date(u.data[0][idx] * 1000).toLocaleTimeString()
					let html = `<div class="tooltip-time">${time}</div>`

					for (let i = 1; i < u.series.length; i++) {
						const s = u.series[i]
						if (s.show) {
							const val = u.data[i][idx]
							const formattedVal =
								unit === 'percent'
									? val != null
										? val.toFixed(1) + '%'
										: '--'
									: val != null
										? val.toFixed(2)
										: '--'

							const color =
								typeof s.stroke === 'function' ? s.stroke(u, i) : s.stroke

							html += `
								<div class="tooltip-row">
									<div class="u-marker" style="background-color: ${color}"></div>
									<div class="u-label">${s.label}:</div>
									<div class="u-value">${formattedVal}</div>
								</div>
							`
						}
					}
					tooltip.innerHTML = html

					const tw = tooltip.offsetWidth
					const th = tooltip.offsetHeight
					const ww = wrapRect.width
					const wh = wrapRect.height

					if (posX + tw > ww) {
						posX = left + originX - tw - 15
					}
					// Only flip flip Y if we're following the mouse (hover-mode)
					if (isMouseOver && posY + th > wh) {
						posY = top + originY - th - 15
					}

					if (posX < 5) posX = 5
					if (posY < 5) posY = 5

					tooltip.style.left = posX + 'px'
					tooltip.style.top = posY + 'px'
				},
			},
		}
	}

	const buildOpts = (width, height, nodeNames, dark) => {
		const theme = getThemeColors(dark)

		const seriesDefs = [
			{ label: 'Time' },
			...nodeNames.map((name, i) => ({
				label: name,
				stroke: COLORS[i % COLORS.length],
				width: 2,
				points: { show: false },
			})),
		]

		const yAxisConfig = {}

		return {
			width,
			height,
			title,
			cursor: {
				drag: { x: false, y: false },
				sync: { key: 'monitoring' },
			},
			legend: {
				show: false,
			},
			plugins: [tooltipPlugin(unit, dark)],
			scales: {
				x: { time: true },
				y: yAxisConfig,
			},
			axes: [
				{
					stroke: theme.axes,
					grid: { stroke: theme.grid },
					ticks: { stroke: theme.grid },
					values: (_, ticks) =>
						ticks.map(t => {
							const d = new Date(t * 1000)
							return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`
						}),
				},
				{
					stroke: theme.axes,
					grid: { stroke: theme.grid },
					ticks: { stroke: theme.grid },
					values: (_, ticks) =>
						ticks.map(v => (unit === 'percent' ? v + '%' : v?.toFixed(1))),
				},
			],
			series: seriesDefs,
		}
	}

	const buildData = (timestamps, series, nodeNames) => {
		if (timestamps.length === 0) return [[], []]
		return [timestamps, ...nodeNames.map(name => series[name] || [])]
	}

	let prevNodeNamesKey = ''
	let prevDark = $state(null)

	const createChart = () => {
		if (!containerEl || !wrapperEl || timestamps.length === 0) return

		const nodeNames = Object.keys(series)
		const dark = isDark
		prevNodeNamesKey = nodeNames.join(',')
		prevDark = dark

		const rect = wrapperEl.getBoundingClientRect()
		const opts = buildOpts(rect.width, 240, nodeNames, dark)
		const data = buildData(timestamps, series, nodeNames)

		if (chart) {
			chart.destroy()
		}

		chart = new uPlot(opts, data, containerEl)
	}

	const updateData = () => {
		if (!chart || timestamps.length === 0) return

		const nodeNames = Object.keys(series)
		const currentKey = nodeNames.join(',')
		const dark = isDark

		// Recreate if nodes changed or theme changed
		if (currentKey !== prevNodeNamesKey || dark !== prevDark) {
			createChart()
			return
		}

		const data = buildData(timestamps, series, nodeNames)
		chart.setData(data)
	}

	$effect(() => {
		// Track reactive dependencies
		timestamps
		series
		isDark

		if (!chart) {
			createChart()
		} else {
			updateData()
		}
	})

	const onEnter = () => (isMouseOver = true)
	const onLeave = () => (isMouseOver = false)

	onMount(() => {
		resizeObserver = new ResizeObserver(entries => {
			if (!chart || !entries[0]) return
			const { width } = entries[0].contentRect
			if (width > 0) {
				chart.setSize({ width, height: 240 })
			}
		})

		if (wrapperEl) {
			resizeObserver.observe(wrapperEl)
		}

		if (containerEl) {
			containerEl.addEventListener('mouseenter', onEnter)
			containerEl.addEventListener('mouseleave', onLeave)
		}
	})

	onDestroy(() => {
		if (resizeObserver) {
			resizeObserver.disconnect()
		}
		if (containerEl) {
			containerEl.removeEventListener('mouseenter', onEnter)
			containerEl.removeEventListener('mouseleave', onLeave)
		}
		if (chart) {
			chart.destroy()
			chart = null
		}
	})
</script>

<div class="chart-wrapper" class:dark={isDark} bind:this={wrapperEl}>
	<div class="chart-container" bind:this={containerEl}></div>
</div>

<style>
	.chart-wrapper {
		width: 100%;
		height: 280px;
		display: flex;
		flex-direction: column;
		background: transparent;
		position: relative; /* Positioning parent for tooltips */
		overflow: hidden; /* Prevent holding parent open during shrink */
		min-width: 0;
	}

	.chart-container {
		width: 100%;
		flex: 1;
		display: flex;
		flex-direction: column;
		z-index: 1;
	}

	.chart-wrapper :global(.u-title) {
		font-size: 0.9rem !important;
		font-weight: 600 !important;
		margin-bottom: 0.5rem !important;
		text-align: center;
	}

	.chart-wrapper.dark :global(.u-title) {
		color: rgba(255, 255, 255, 0.85) !important;
	}

	.chart-wrapper :global(.u-tooltip) {
		position: absolute;
		z-index: 1000;
		display: none;
		pointer-events: none;
		padding: 10px 14px;
		background: rgba(255, 255, 255, 0.98);
		border: 1px solid rgba(34, 36, 38, 0.25);
		border-radius: 8px;
		font-size: 0.8rem;
		box-shadow: 0 6px 20px rgba(0, 0, 0, 0.18);
		min-width: 200px;
		color: #333;
		backdrop-filter: blur(8px);
		transition: transform 0.1s ease-out;
		will-change: left, top;
	}

	.chart-wrapper :global(.u-tooltip.dark) {
		background: rgba(45, 45, 45, 0.98);
		border-color: rgba(255, 255, 255, 0.2);
		color: #eee;
		box-shadow: 0 6px 20px rgba(0, 0, 0, 0.45);
	}

	.chart-wrapper :global(.u-tooltip .tooltip-time) {
		font-weight: 800;
		margin-bottom: 8px;
		padding-bottom: 6px;
		border-bottom: 1.5px solid rgba(33, 133, 208, 0.4);
		color: #2185d0;
		font-size: 0.85rem;
	}

	.chart-wrapper :global(.u-tooltip.dark .tooltip-time) {
		border-bottom-color: rgba(84, 200, 255, 0.4);
		color: #54c8ff;
	}

	.chart-wrapper :global(.u-tooltip .tooltip-row) {
		display: flex;
		align-items: center;
		gap: 12px;
		margin-top: 5px;
	}

	.chart-wrapper :global(.u-tooltip .u-marker) {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		flex-shrink: 0;
		box-shadow: 0 0 0 2px white;
	}
	.chart-wrapper :global(.u-tooltip.dark .u-marker) {
		box-shadow: 0 0 0 2px #333;
	}

	.chart-wrapper :global(.u-tooltip .u-label) {
		flex: 1;
		font-weight: 600;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		color: #555;
	}

	.chart-wrapper :global(.u-tooltip.dark .u-label) {
		color: #bbb;
	}

	.chart-wrapper :global(.u-tooltip .u-value) {
		font-weight: 800;
		font-family: 'JetBrains Mono', 'Roboto Mono', monospace;
		color: #111;
		min-width: 60px;
		text-align: right;
	}

	.chart-wrapper :global(.u-tooltip.dark .u-value) {
		color: #fff;
	}
</style>
