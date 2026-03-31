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

	const expectedConn = (conn) => ({
		name: '',
		host: '',
		port: '',
		useAuth: false,
		user: '',
		password: '',
		addHeaders: false,
		headers: [],
		...conn
	});

	beforeEach(() => {
		store = createStoreon([history]);
	});

	it('initializes with empty connection history', () => {
		expect(store.get().history.connection).toEqual([]);
	});

	it('hydrates history state', () => {
		store.dispatch('history/hydrate', { connection: [conn1] });
		expect(store.get().history.connection).toEqual([expectedConn(conn1)]);
	});

	it('adds a connection to history', () => {
		store.dispatch('history/connection/add', conn1);
		expect(store.get().history.connection).toEqual([expectedConn(conn1)]);
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
		expect(store.get().history.connection).toEqual([expectedConn(conn2)]);
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

	it('deduplicates connections when one has metadata like version', () => {
		const connWithVersion = { ...conn1, version: '8.12.0' };
		store.dispatch('history/connection/add', conn1);
		store.dispatch('history/connection/add', connWithVersion);
		expect(store.get().history.connection).toHaveLength(1);
		// It should NOT have the version in history
		expect(store.get().history.connection[0].version).toBeUndefined();
	});

	it('deduplicates when both have metadata but are otherwise same', () => {
		const connV1 = { ...conn1, version: '7.10.0' };
		const connV2 = { ...conn1, version: '8.12.0' };
		store.dispatch('history/connection/add', connV1);
		store.dispatch('history/connection/add', connV2);
		expect(store.get().history.connection).toHaveLength(1);
	});
});
