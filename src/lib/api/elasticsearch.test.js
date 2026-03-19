import { describe, it, expect, vi, beforeEach } from 'vitest';
import API from './elasticsearch.js';

describe('Elasticsearch API Client', () => {
	let api;
	const mockConnection = { host: 'localhost', port: '9200', useAuth: false };

	beforeEach(() => {
		global.fetch = vi.fn(() =>
			Promise.resolve({
				ok: true,
				json: () => Promise.resolve({ data: { tagline: 'You Know, for Search' } })
			})
		);
		api = new API(mockConnection);
	});

	it('test() method targets the /test endpoint', async () => {
		const result = await api.test();
		expect(global.fetch).toHaveBeenCalledWith('/api/elastic/test', expect.objectContaining({
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: expect.stringContaining('"host":"localhost"')
		}));
		expect(result.success).toBe(true);
		expect(result.tagline).toBe('You Know, for Search');
	});

	it('getIndices() targets the /indices endpoint and parses cat responses', async () => {
		global.fetch = vi.fn(() =>
			Promise.resolve({
				ok: true,
				json: () => Promise.resolve({
					data: "health status index uuid pri rep docs.count docs.deleted store.size pri.store.size\ngreen open my-index q1w2 1 1 0 0 200b 200b\n"
				})
			})
		);

		const result = await api.getIndices();
		expect(global.fetch).toHaveBeenCalledWith('/api/elastic/indices', expect.any(Object));
		expect(result.columns[0]).toBe('health');
		expect(result.data.length).toBe(1); // One row of data parsed
		expect(result.data[0][2]).toBe('my-index');
	});

	it('_request() handles errors gracefully', async () => {
		global.fetch = vi.fn(() =>
			Promise.resolve({
				ok: false,
				json: () => Promise.resolve({ error: 'Index not found' })
			})
		);

		await expect(api.getIndex('missing-index'))
			.rejects
			.toThrow('Index not found');
	});
});
