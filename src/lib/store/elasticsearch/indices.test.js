import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createStoreon } from 'storeon';
import { indices } from './indices';

vi.mock('../../api/elasticsearch', () => ({
	default: vi.fn(),
}));

describe('indices store module', () => {
	let store;

	beforeEach(() => {
		store = createStoreon([indices]);
	});

	it('initializes with empty data and loading=false', () => {
		const state = store.get().indices;
		expect(state.columns).toEqual([]);
		expect(state.data).toEqual([]);
		expect(state.loading).toBe(false);
		expect(state.search).toBe('');
		expect(state.sorting).toEqual([]);
	});

	it('updates indices state', () => {
		store.dispatch('elasticsearch/indices/update', {
			columns: ['health', 'index'],
			data: [['green', 'my-index']],
			loading: false,
		});
		const state = store.get().indices;
		expect(state.columns).toEqual(['health', 'index']);
		expect(state.data).toHaveLength(1);
	});

	it('merges partial updates', () => {
		store.dispatch('elasticsearch/indices/update', { search: 'test' });
		const state = store.get().indices;
		expect(state.search).toBe('test');
		expect(state.columns).toEqual([]); // preserved from init
	});

	it('disconnected clears indices data', () => {
		store.dispatch('elasticsearch/indices/update', {
			columns: ['a'],
			data: [['b']],
		});
		store.dispatch('disconnected');
		const state = store.get().indices;
		expect(state.columns).toEqual([]);
		expect(state.data).toEqual([]);
	});
});
