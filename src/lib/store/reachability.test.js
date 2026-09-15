import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createStoreon } from 'storeon';
import API from '../api/elasticsearch';
import { app } from './app';
import { connection } from './connection';
import { server } from './server';
import { notifications } from './notifications';
import { indices } from './elasticsearch/indices';
import { shards } from './elasticsearch/shards';
import { allocation } from './elasticsearch/allocation';
import { mappings } from './elasticsearch/mappings';
import { monitoring } from './elasticsearch/monitoring';

// A network-level failure must only turn the header icon red. It must not go
// through `disconnected`, which closes the SSH tunnel, clears the data stores
// and posts a disconnection notice.
describe('reachability across the real store modules', () => {
	let store;
	let disconnected;
	const tunneled = { host: 'http://es.internal', port: '9200', useSshTunnel: true };
	const loadedIndices = { columns: ['index'], data: [['logs']] };

	const respond = (body, ok) => {
		global.fetch = vi.fn(() => Promise.resolve({ ok, json: () => Promise.resolve(body) }));
	};

	beforeEach(() => {
		store = createStoreon([app, connection, server, notifications, indices, shards, allocation, mappings, monitoring]);
		disconnected = vi.fn();
		store.on('disconnected', disconnected);
		store.dispatch('app/hydrate', { windowId: 'win-1' });
		store.dispatch('connection/update', tunneled);
		store.dispatch('elasticsearch/indices/update', loadedIndices);
		store.dispatch('server/reachability', true);
	});

	it('turns unreachable without disconnecting', async () => {
		respond({ error: 'Request timed out', unreachable: true }, false);

		await expect(new API(tunneled, 'win-1').getIndices()).rejects.toThrow();

		expect(store.get().server.reachable).toBe(false);
		expect(disconnected).not.toHaveBeenCalled();
		const urls = global.fetch.mock.calls.map(([url]) => url);
		expect(urls.some(url => url.includes('tunnel/close'))).toBe(false);
		expect(store.get().indices.data).toEqual(loadedIndices.data);
		expect(store.get().notifications).toEqual([]);
	});

	it('turns reachable again on the next success', async () => {
		respond({ error: 'Request timed out', unreachable: true }, false);
		await expect(new API(tunneled, 'win-1').getIndices()).rejects.toThrow();

		respond({ data: [] }, true);
		await new API(tunneled, 'win-1').getIndices();

		expect(store.get().server.reachable).toBe(true);
	});

	it('keeps the flag on an error the cluster returned', async () => {
		respond({ error: 'index_not_found_exception' }, false);

		await expect(new API(tunneled, 'win-1').genericRequest({ path: '/missing' })).rejects.toThrow();

		expect(store.get().server.reachable).toBe(true);
	});
});
