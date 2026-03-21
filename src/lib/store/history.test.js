import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createStoreon } from 'storeon';
import { history } from './history';

vi.mock('../utils/storage', () => ({
	setStorage: vi.fn(),
	getStorage: vi.fn(),
}));

describe('history store module', () => {
	let store;

	const conn1 = { name: 'Local', host: 'localhost', port: '9200' };
	const conn2 = { name: 'Remote', host: 'remote.host', port: '9200' };

	beforeEach(() => {
		store = createStoreon([history]);
	});

	it('initializes with empty connection history', () => {
		expect(store.get().history.connection).toEqual([]);
	});

	it('hydrates history state', () => {
		store.dispatch('history/hydrate', { connection: [conn1] });
		expect(store.get().history.connection).toEqual([conn1]);
	});

	it('adds a connection to history', () => {
		store.dispatch('history/connection/add', conn1);
		expect(store.get().history.connection).toEqual([conn1]);
	});

	it('prevents duplicate connections', () => {
		store.dispatch('history/connection/add', conn1);
		store.dispatch('history/connection/add', conn1);
		expect(store.get().history.connection).toHaveLength(1);
	});

	it('caps history at 10 entries', () => {
		for (let i = 0; i < 12; i++) {
			store.dispatch('history/connection/add', {
				name: `Server ${i}`,
				host: `host${i}`,
				port: '9200',
			});
		}
		expect(store.get().history.connection).toHaveLength(10);
		// The first two should have been shifted out
		expect(store.get().history.connection[0].name).toBe('Server 2');
	});

	it('deletes a connection from history', () => {
		store.dispatch('history/connection/add', conn1);
		store.dispatch('history/connection/add', conn2);
		store.dispatch('history/connection/delete', conn1);
		expect(store.get().history.connection).toEqual([conn2]);
	});

	it('delete is a no-op for non-existent connection', () => {
		store.dispatch('history/connection/add', conn1);
		store.dispatch('history/connection/delete', conn2);
		expect(store.get().history.connection).toHaveLength(1);
	});

	it('clears all connections', () => {
		store.dispatch('history/connection/add', conn1);
		store.dispatch('history/connection/add', conn2);
		store.dispatch('history/connection/clear');
		expect(store.get().history.connection).toEqual([]);
	});
});
