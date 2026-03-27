import API from '../../api/elasticsearch'

const MAX_BUFFER_DURATION_MS = 10 * 60 * 1000 // 10 minutes
const DEFAULT_INTERVAL = 10000

const INTERVALS = [5000, 10000, 30000, 60000]

const initialState = () => ({
	monitoring: {
		autoRefresh: true,
		interval: DEFAULT_INTERVAL,
		polling: false,
		consecutiveErrors: 0,
		errorMessage: null,
		clusterHealth: null,
		clusterStats: null,
		nodeStats: {
			timestamps: [],
			series: {},
		},
	},
})

/**
 * Trims the time-series buffer to keep only data points
 * within the MAX_BUFFER_DURATION_MS sliding window.
 */
const trimBuffer = (nodeStats) => {
	const { timestamps, series } = nodeStats
	if (timestamps.length === 0) return nodeStats

	const cutoff = timestamps[timestamps.length - 1] - MAX_BUFFER_DURATION_MS / 1000
	let startIndex = 0

	while (startIndex < timestamps.length && timestamps[startIndex] < cutoff) {
		startIndex++
	}

	if (startIndex === 0) return nodeStats

	const trimmedTimestamps = timestamps.slice(startIndex)
	const trimmedSeries = {}

	for (const [nodeId, metrics] of Object.entries(series)) {
		trimmedSeries[nodeId] = {
			cpu: metrics.cpu.slice(startIndex),
			jvmHeap: metrics.jvmHeap.slice(startIndex),
			osMem: metrics.osMem.slice(startIndex),
			loadAvg: metrics.loadAvg.slice(startIndex),
		}
	}

	return { timestamps: trimmedTimestamps, series: trimmedSeries }
}

/**
 * Extracts per-node metrics from the _nodes/stats response
 * and appends them to the existing time-series buffer.
 */
const appendNodeStats = (currentNodeStats, nodesResponse) => {
	const timestamp = Math.floor(Date.now() / 1000)
	const timestamps = [...currentNodeStats.timestamps, timestamp]
	const series = { ...currentNodeStats.series }

	if (!nodesResponse || !nodesResponse.nodes) return currentNodeStats

	for (const [nodeId, node] of Object.entries(nodesResponse.nodes)) {
		const nodeName = node.name || nodeId

		if (!series[nodeName]) {
			// New node — backfill with nulls so chart lines are aligned
			const backfill = new Array(timestamps.length - 1).fill(null)
			series[nodeName] = {
				cpu: [...backfill],
				jvmHeap: [...backfill],
				osMem: [...backfill],
				loadAvg: [...backfill],
			}
		}

		series[nodeName].cpu.push(node.os?.cpu?.percent ?? null)
		series[nodeName].jvmHeap.push(node.jvm?.mem?.heap_used_percent ?? null)
		series[nodeName].osMem.push(node.os?.mem?.used_percent ?? null)
		series[nodeName].loadAvg.push(node.os?.cpu?.load_average?.['1m'] ?? null)
	}

	// Pad nodes that didn't appear in this response
	for (const [, metrics] of Object.entries(series)) {
		if (metrics.cpu.length < timestamps.length) {
			metrics.cpu.push(null)
			metrics.jvmHeap.push(null)
			metrics.osMem.push(null)
			metrics.loadAvg.push(null)
		}
	}

	return trimBuffer({ timestamps, series })
}

export { INTERVALS, MAX_BUFFER_DURATION_MS, initialState, trimBuffer, appendNodeStats }

export const monitoring = (store) => {
	let intervalId = null

	store.on('@init', initialState)

	store.on('connected', () => {
		if (store.get().monitoring.autoRefresh) {
			store.dispatch('monitoring/start')
		}
	})

	store.on('disconnected', () => {
		store.dispatch('monitoring/stop')
		store.dispatch('monitoring/update', initialState().monitoring)
	})

	store.on('monitoring/update', (state, data) => ({
		monitoring: { ...state.monitoring, ...data },
	}))

	store.on('monitoring/config', (state, config) => {
		const validInterval = INTERVALS.includes(config.interval)
			? config.interval
			: state.monitoring.interval

		const newConfig = {
			...state.monitoring,
			autoRefresh: config.autoRefresh ?? state.monitoring.autoRefresh,
			interval: validInterval,
		}

		// Restart polling if interval or autoRefresh changed
		if (intervalId) {
			store.dispatch('monitoring/stop')
		}
		store.dispatch('monitoring/update', {
			autoRefresh: newConfig.autoRefresh,
			interval: newConfig.interval,
		})
		if (newConfig.autoRefresh) {
			store.dispatch('monitoring/start')
		}
	})

	store.on('monitoring/tick', async (state) => {
		if (state.monitoring.polling) return

		store.dispatch('monitoring/update', { polling: true })

		try {
			const api = new API(state.connection)
			const [clusterHealth, clusterStats, nodesResponse] = await Promise.all([
				api.getClusterHealth(),
				api.getClusterStats(),
				api.getNodeStats(),
			])

			const nodeStats = appendNodeStats(state.monitoring.nodeStats, nodesResponse)

			store.dispatch('monitoring/update', {
				clusterHealth,
				clusterStats,
				nodeStats,
				polling: false,
				consecutiveErrors: 0,
				errorMessage: null,
			})
		} catch (error) {
			const consecutiveErrors = state.monitoring.consecutiveErrors + 1
			store.dispatch('monitoring/update', {
				polling: false,
				consecutiveErrors,
				errorMessage:
					consecutiveErrors >= 3 ? `Unable to reach cluster: ${error.message}` : null,
			})
		}
	})

	store.on('monitoring/start', (state) => {
		if (intervalId) return

		// Immediate first tick
		store.dispatch('monitoring/tick')

		intervalId = setInterval(() => {
			if (store.get().monitoring.autoRefresh) {
				store.dispatch('monitoring/tick')
			}
		}, state.monitoring.interval)
	})

	store.on('monitoring/stop', () => {
		if (intervalId) {
			clearInterval(intervalId)
			intervalId = null
		}
	})
}
