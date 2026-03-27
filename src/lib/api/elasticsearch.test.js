import { describe, it, expect, vi, beforeEach } from 'vitest';
import API from './elasticsearch';

describe('Elasticsearch API Client - Expanded', () => {
	let api;
	const mockConnection = { host: 'localhost', port: '9200', useAuth: false };

	const mockFetch = (data, ok = true) => {
		global.fetch = vi.fn(() =>
			Promise.resolve({
				ok,
				json: () => Promise.resolve(ok ? { data } : { error: data }),
			})
		);
	};

	beforeEach(() => {
		api = new API(mockConnection);
	});

	describe('formatCatJson', () => {
		it('parses column headers and data rows from JSON array', () => {
			const input = [
				{ health: 'green', status: 'open', index: 'my-index' },
				{ health: 'yellow', status: 'open', index: 'logs' }
			];
			const result = api.formatCatJson(input);
			expect(result.columns).toEqual(['health', 'status', 'index']);
			expect(result.data).toHaveLength(2);
			expect(result.data[0]).toEqual(['green', 'open', 'my-index']);
		});

		it('handles empty input gracefully', () => {
			const result = api.formatCatJson([]);
			expect(result.data).toEqual([]);
		});
	});

	describe('test()', () => {
		it('returns success with tagline', async () => {
			mockFetch({ tagline: 'You Know, for Search', version: { number: '8.12.0' } });
			const result = await api.test();
			expect(result.success).toBe(true);
			expect(result.message).toBe('You Know, for Search');
			expect(result.tagline).toBe('You Know, for Search');
		});

		it('returns success=false when no tagline', async () => {
			mockFetch({});
			const result = await api.test();
			expect(result.success).toBe(false);
		});

		it('throws ConnectionError on failure', async () => {
			mockFetch('Connection refused', false);
			await expect(api.test()).rejects.toThrow();
		});
	});

	describe('getIndices()', () => {
		it('parses cat JSON response', async () => {
			mockFetch([{ health: 'green', status: 'open', index: 'idx1' }]);
			const result = await api.getIndices();
			expect(result.columns[0]).toBe('health');
			expect(result.data[0][2]).toBe('idx1');
		});
	});

	describe('getAllocation()', () => {
		it('parses cat JSON response', async () => {
			mockFetch([{ shards: '5', 'disk.indices': '10gb' }]);
			const result = await api.getAllocation();
			expect(result.columns).toEqual(['shards', 'disk.indices']);
		});
	});

	describe('getShards()', () => {
		it('parses cat JSON response', async () => {
			mockFetch([{ index: 'idx1', shard: '0' }]);
			const result = await api.getShards();
			expect(result.columns).toEqual(['index', 'shard']);
		});
	});

	describe('uriSearch()', () => {
		it('calls search/uri endpoint', async () => {
			mockFetch({ hits: { total: { value: 1 }, hits: [] } });
			const result = await api.uriSearch({ index: '_all', query: '*' });
			expect(global.fetch).toHaveBeenCalledWith(
				'/api/elastic/search/uri',
				expect.any(Object)
			);
			expect(result.hits).toBeDefined();
		});
	});

	describe('bodySearch()', () => {
		it('calls search/body endpoint', async () => {
			mockFetch({ hits: { total: { value: 0 }, hits: [] } });
			const result = await api.bodySearch({ index: '_all', query: {} });
			expect(global.fetch).toHaveBeenCalledWith(
				'/api/elastic/search/body',
				expect.any(Object)
			);
			expect(result.hits).toBeDefined();
		});
	});

	describe('deleteDocument()', () => {
		it('calls document/delete endpoint', async () => {
			mockFetch({ result: 'deleted' });
			const result = await api.deleteDocument('my-index', '_doc', '1');
			expect(global.fetch).toHaveBeenCalledWith(
				'/api/elastic/document/delete',
				expect.any(Object)
			);
			expect(result.result).toBe('deleted');
		});
	});

	describe('updateDocument()', () => {
		it('calls document/update endpoint', async () => {
			mockFetch({ result: 'updated' });
			const result = await api.updateDocument('my-index', '1', {
				field: 'value',
			});
			expect(global.fetch).toHaveBeenCalledWith(
				'/api/elastic/document/update',
				expect.any(Object)
			);
			expect(result.result).toBe('updated');
		});

		it('throws ConnectionError on failure', async () => {
			mockFetch('Document not found', false);
			await expect(
				api.updateDocument('idx', '1', {})
			).rejects.toThrow();
		});
	});

	describe('indexDocument()', () => {
		it('calls document/index endpoint', async () => {
			mockFetch({ _id: '1', result: 'created' });
			const result = await api.indexDocument('idx', '_doc', '1', {
				name: 'test',
			});
			expect(global.fetch).toHaveBeenCalledWith(
				'/api/elastic/document/index',
				expect.any(Object)
			);
			expect(result._id).toBe('1');
		});
	});

	describe('getIndex()', () => {
		it('calls index/get endpoint', async () => {
			mockFetch({ 'my-index': { mappings: {} } });
			await api.getIndex('my-index');
			expect(global.fetch).toHaveBeenCalledWith(
				'/api/elastic/index/get',
				expect.any(Object)
			);
		});
	});

	describe('deleteIndex()', () => {
		it('calls index/delete endpoint', async () => {
			mockFetch({ acknowledged: true });
			const result = await api.deleteIndex('my-index');
			expect(result.acknowledged).toBe(true);
		});
	});

	describe('closeIndex()', () => {
		it('calls index/close endpoint', async () => {
			mockFetch({ acknowledged: true });
			await api.closeIndex('my-index');
			expect(global.fetch).toHaveBeenCalledWith(
				'/api/elastic/index/close',
				expect.any(Object)
			);
		});
	});

	describe('openIndex()', () => {
		it('calls index/open endpoint', async () => {
			mockFetch({ acknowledged: true });
			await api.openIndex('my-index');
			expect(global.fetch).toHaveBeenCalledWith(
				'/api/elastic/index/open',
				expect.any(Object)
			);
		});
	});

	describe('createIndex()', () => {
		it('calls index/create endpoint', async () => {
			mockFetch({ acknowledged: true });
			await api.createIndex('new-index', { number_of_shards: 1 });
			expect(global.fetch).toHaveBeenCalledWith(
				'/api/elastic/index/create',
				expect.any(Object)
			);
		});
	});

	describe('cloneIndex()', () => {
		it('calls index/clone endpoint with correct params', async () => {
			mockFetch({ acknowledged: true });
			await api.cloneIndex('source', 'target');
			const body = JSON.parse(global.fetch.mock.calls[0][1].body);
			expect(body.existingIndex).toBe('source');
			expect(body.newIndex).toBe('target');
		});
	});

	describe('wipeIndex()', () => {
		it('calls index/wipe endpoint', async () => {
			mockFetch({ deleted: 100 });
			await api.wipeIndex('my-index');
			expect(global.fetch).toHaveBeenCalledWith(
				'/api/elastic/index/wipe',
				expect.any(Object)
			);
		});
	});

	describe('updateIndexMapping()', () => {
		it('calls index/mapping endpoint', async () => {
			mockFetch({ acknowledged: true });
			await api.updateIndexMapping('my-index', {
				properties: { field: { type: 'text' } },
			});
			expect(global.fetch).toHaveBeenCalledWith(
				'/api/elastic/index/mapping',
				expect.any(Object)
			);
		});
	});

	describe('updateIndexSettings()', () => {
		it('calls index/settings endpoint', async () => {
			mockFetch({ acknowledged: true });
			await api.updateIndexSettings('my-index', {
				number_of_replicas: 2,
			});
			expect(global.fetch).toHaveBeenCalledWith(
				'/api/elastic/index/settings',
				expect.any(Object)
			);
		});
	});

	describe('deleteIndexAlias()', () => {
		it('calls alias/delete endpoint', async () => {
			mockFetch({ acknowledged: true });
			await api.deleteIndexAlias('my-index', 'my-alias');
			expect(global.fetch).toHaveBeenCalledWith(
				'/api/elastic/alias/delete',
				expect.any(Object)
			);
		});
	});

	describe('createIndexAlias()', () => {
		it('calls alias/create endpoint', async () => {
			mockFetch({ acknowledged: true });
			await api.createIndexAlias('my-index', 'my-alias', {});
			expect(global.fetch).toHaveBeenCalledWith(
				'/api/elastic/alias/create',
				expect.any(Object)
			);
		});
	});

	describe('getClusterHealth()', () => {
		it('calls cluster/health endpoint', async () => {
			mockFetch({ status: 'green', cluster_name: 'test' });
			const result = await api.getClusterHealth();
			expect(global.fetch).toHaveBeenCalledWith(
				'/api/elastic/cluster/health',
				expect.any(Object)
			);
			expect(result.status).toBe('green');
		});

		it('throws ConnectionError on failure', async () => {
			mockFetch('Cluster not found', false);
			await expect(api.getClusterHealth()).rejects.toThrow();
		});
	});

	describe('getClusterStats()', () => {
		it('calls cluster/stats endpoint', async () => {
			mockFetch({ indices: { count: 5 } });
			const result = await api.getClusterStats();
			expect(global.fetch).toHaveBeenCalledWith(
				'/api/elastic/cluster/stats',
				expect.any(Object)
			);
			expect(result.indices.count).toBe(5);
		});

		it('throws ConnectionError on failure', async () => {
			mockFetch('Stats unavailable', false);
			await expect(api.getClusterStats()).rejects.toThrow();
		});
	});

	describe('getNodeStats()', () => {
		it('calls nodes/stats endpoint', async () => {
			mockFetch({ nodes: { node1: { os: {} } } });
			const result = await api.getNodeStats();
			expect(global.fetch).toHaveBeenCalledWith(
				'/api/elastic/nodes/stats',
				expect.any(Object)
			);
			expect(result.nodes.node1).toBeDefined();
		});

		it('throws ConnectionError on failure', async () => {
			mockFetch('Nodes unavailable', false);
			await expect(api.getNodeStats()).rejects.toThrow();
		});
	});

	describe('_request()', () => {
		it('sends connection in the payload', async () => {
			mockFetch('ok');
			await api._request('test', { extra: 'param' });
			const body = JSON.parse(global.fetch.mock.calls[0][1].body);
			expect(body.connection).toEqual(mockConnection);
			expect(body.extra).toBe('param');
		});

		it('throws on non-ok response', async () => {
			mockFetch('Forbidden', false);
			await expect(api._request('test')).rejects.toThrow('Forbidden');
		});
	});
});
