import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createStoreon } from 'storeon';
import {
	monitoring,
	trimBuffer,
	appendNodeStats,
	INTERVALS,
	MAX_BUFFER_DURATION_MS,
} from './monitoring';

vi.mock('../../api/elasticsearch', () => ({
	default: vi.fn(),
}));

describe('monitoring store module', () => {
	let store;

	beforeEach(() => {
		vi.clearAllMocks();
		store = createStoreon([monitoring]);
	});

	describe('initialState', () => {
		it('initializes with correct default state', () => {
			const state = store.get().monitoring;
			expect(state.autoRefresh).toBe(true);
			expect(state.interval).toBe(10000);
			expect(state.polling).toBe(false);
			expect(state.consecutiveErrors).toBe(0);
			expect(state.errorMessage).toBeNull();
			expect(state.clusterHealth).toBeNull();
			expect(state.clusterStats).toBeNull();
			expect(state.nodeStats.timestamps).toEqual([]);
			expect(state.nodeStats.series).toEqual({});
		});
	});

	describe('monitoring/update', () => {
		it('merges partial updates', () => {
			store.dispatch('monitoring/update', { polling: true });
			const state = store.get().monitoring;
			expect(state.polling).toBe(true);
			expect(state.autoRefresh).toBe(true); // preserved
		});

		it('merges cluster health data', () => {
			const health = { status: 'green', cluster_name: 'test' };
			store.dispatch('monitoring/update', { clusterHealth: health });
			expect(store.get().monitoring.clusterHealth).toEqual(health);
		});
	});

	describe('disconnected', () => {
		it('resets monitoring state on disconnect', () => {
			store.dispatch('monitoring/update', {
				clusterHealth: { status: 'green' },
				consecutiveErrors: 5,
				errorMessage: 'some error',
			});
			store.dispatch('disconnected');
			const state = store.get().monitoring;
			expect(state.clusterHealth).toBeNull();
			expect(state.consecutiveErrors).toBe(0);
			expect(state.errorMessage).toBeNull();
		});
	});

	describe('monitoring/config', () => {
		it('updates autoRefresh', () => {
			store.dispatch('monitoring/config', {
				autoRefresh: false,
				interval: 10000,
			});
			expect(store.get().monitoring.autoRefresh).toBe(false);
		});

		it('validates interval values', () => {
			store.dispatch('monitoring/config', {
				autoRefresh: true,
				interval: 99999, // invalid
			});
			// Should keep existing interval
			expect(store.get().monitoring.interval).toBe(10000);
		});

		it('accepts valid interval values', () => {
			store.dispatch('monitoring/config', {
				autoRefresh: true,
				interval: 30000,
			});
			expect(store.get().monitoring.interval).toBe(30000);
		});
	});
});

describe('trimBuffer', () => {
	it('returns unchanged buffer when within time window', () => {
		const now = Math.floor(Date.now() / 1000);
		const nodeStats = {
			timestamps: [now - 10, now],
			series: {
				node1: {
					cpu: [50, 60],
					jvmHeap: [40, 45],
					osMem: [70, 75],
					loadAvg: [1.0, 1.5],
				},
			},
		};
		const result = trimBuffer(nodeStats);
		expect(result).toBe(nodeStats); // same reference, no trimming
	});

	it('trims data points outside the sliding window', () => {
		const now = Math.floor(Date.now() / 1000);
		const oldTimestamp = now - MAX_BUFFER_DURATION_MS / 1000 - 60; // 1 min before cutoff
		const nodeStats = {
			timestamps: [oldTimestamp, now - 30, now],
			series: {
				node1: {
					cpu: [50, 60, 70],
					jvmHeap: [40, 45, 50],
					osMem: [70, 75, 80],
					loadAvg: [1.0, 1.5, 2.0],
				},
			},
		};
		const result = trimBuffer(nodeStats);
		expect(result.timestamps).toHaveLength(2);
		expect(result.series.node1.cpu).toHaveLength(2);
		expect(result.series.node1.cpu).toEqual([60, 70]);
	});

	it('handles empty buffer', () => {
		const nodeStats = { timestamps: [], series: {} };
		const result = trimBuffer(nodeStats);
		expect(result).toBe(nodeStats);
	});
});

describe('appendNodeStats', () => {
	it('appends metrics from a single node', () => {
		const current = { timestamps: [], series: {} };
		const response = {
			nodes: {
				nodeId1: {
					name: 'node-1',
					os: {
						cpu: { percent: 45, load_average: { '1m': 1.2 } },
						mem: { used_percent: 62 },
					},
					jvm: { mem: { heap_used_percent: 35 } },
				},
			},
		};

		const result = appendNodeStats(current, response);
		expect(result.timestamps).toHaveLength(1);
		expect(result.series['node-1'].cpu).toEqual([45]);
		expect(result.series['node-1'].jvmHeap).toEqual([35]);
		expect(result.series['node-1'].osMem).toEqual([62]);
		expect(result.series['node-1'].loadAvg).toEqual([1.2]);
	});

	it('appends to existing buffer', () => {
		const now = Math.floor(Date.now() / 1000);
		const current = {
			timestamps: [now - 10],
			series: {
				'node-1': {
					cpu: [40],
					jvmHeap: [30],
					osMem: [60],
					loadAvg: [1.0],
				},
			},
		};
		const response = {
			nodes: {
				nodeId1: {
					name: 'node-1',
					os: {
						cpu: { percent: 50, load_average: { '1m': 1.5 } },
						mem: { used_percent: 65 },
					},
					jvm: { mem: { heap_used_percent: 38 } },
				},
			},
		};

		const result = appendNodeStats(current, response);
		expect(result.timestamps).toHaveLength(2);
		expect(result.series['node-1'].cpu).toEqual([40, 50]);
	});

	it('handles null response gracefully', () => {
		const current = { timestamps: [], series: {} };
		const result = appendNodeStats(current, null);
		expect(result).toBe(current);
	});

	it('backfills new nodes with nulls', () => {
		const now = Math.floor(Date.now() / 1000);
		const current = {
			timestamps: [now - 20, now - 10],
			series: {
				'node-1': {
					cpu: [40, 50],
					jvmHeap: [30, 35],
					osMem: [60, 65],
					loadAvg: [1.0, 1.2],
				},
			},
		};
		const response = {
			nodes: {
				nodeId1: {
					name: 'node-1',
					os: {
						cpu: { percent: 55, load_average: { '1m': 1.3 } },
						mem: { used_percent: 70 },
					},
					jvm: { mem: { heap_used_percent: 40 } },
				},
				nodeId2: {
					name: 'node-2',
					os: {
						cpu: { percent: 20, load_average: { '1m': 0.5 } },
						mem: { used_percent: 45 },
					},
					jvm: { mem: { heap_used_percent: 25 } },
				},
			},
		};

		const result = appendNodeStats(current, response);
		expect(result.series['node-2'].cpu).toEqual([null, null, 20]);
		expect(result.series['node-2'].cpu).toHaveLength(3);
	});

	it('uses nodeId as fallback when name is missing', () => {
		const current = { timestamps: [], series: {} };
		const response = {
			nodes: {
				nodeId1: {
					os: {
						cpu: { percent: 30, load_average: { '1m': 0.8 } },
						mem: { used_percent: 50 },
					},
					jvm: { mem: { heap_used_percent: 20 } },
				},
			},
		};

		const result = appendNodeStats(current, response);
		expect(result.series['nodeId1']).toBeDefined();
		expect(result.series['nodeId1'].cpu).toEqual([30]);
	});
});

describe('INTERVALS constant', () => {
	it('contains the expected intervals', () => {
		expect(INTERVALS).toEqual([5000, 10000, 30000, 60000]);
	});
});
