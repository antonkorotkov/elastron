import { describe, it, expect, vi } from 'vitest';
import { createClient, handleElasticRequest } from './elastic';

// Mock the Client constructor
vi.mock('@elastic/elasticsearch', () => {
	return {
		Client: class MockClient {
			constructor(opts) {
				this._opts = opts;
				this.close = vi.fn();
			}
		}
	};
});

describe('createClient', () => {
	it('builds a basic node URL without auth', () => {
		const client = createClient({
			host: 'localhost',
			port: '9200',
			useAuth: false,
		});
		expect(client._opts.node).toBe('http://localhost:9200');
		expect(client._opts.auth).toBeUndefined();
	});

	it('preserves https protocol', () => {
		const client = createClient({
			host: 'https://my-cluster.example.com',
			port: '9243',
			useAuth: false,
		});
		expect(client._opts.node).toBe('https://my-cluster.example.com:9243');
	});

	it('handles trailing slashes on host', () => {
		const client = createClient({
			host: 'http://localhost/',
			port: '9200',
			useAuth: false,
		});
		expect(client._opts.node).toBe('http://localhost:9200');
	});

	it('omits port when zero or empty', () => {
		const client = createClient({
			host: 'http://localhost',
			port: '0',
			useAuth: false,
		});
		expect(client._opts.node).toBe('http://localhost');
	});

	it('includes auth when useAuth is true', () => {
		const client = createClient({
			host: 'localhost',
			port: '9200',
			useAuth: true,
			user: 'elastic',
			password: 'changeme',
		});
		expect(client._opts.auth).toEqual({
			username: 'elastic',
			password: 'changeme',
		});
	});

	it('includes custom headers when addHeaders is true', () => {
		const client = createClient({
			host: 'localhost',
			port: '9200',
			useAuth: false,
			addHeaders: true,
			headers: [
				{ name: 'X-Custom', value: 'foo' },
				{ name: 'Authorization', value: 'Bearer token' },
			],
		});
		expect(client._opts.headers).toEqual({
			'X-Custom': 'foo',
			Authorization: 'Bearer token',
		});
	});

	it('skips empty custom headers', () => {
		const client = createClient({
			host: 'localhost',
			port: '9200',
			useAuth: false,
			addHeaders: true,
			headers: [{ name: '', value: '' }],
		});
		expect(client._opts.headers).toBeUndefined();
	});

	it('does not include headers when addHeaders is false', () => {
		const client = createClient({
			host: 'localhost',
			port: '9200',
			useAuth: false,
			addHeaders: false,
			headers: [{ name: 'X-Custom', value: 'bar' }],
		});
		expect(client._opts.headers).toBeUndefined();
	});
});

describe('handleElasticRequest', () => {
	const makeRequest = (body) => ({
		json: () => (body instanceof Error ? Promise.reject(body) : Promise.resolve(body)),
	});

	it('returns 400 for invalid JSON payload', async () => {
		const request = {
			json: () => Promise.reject(new Error('bad json')),
		};
		const response = await handleElasticRequest(request, vi.fn());
		const data = await response.json();
		expect(response.status).toBe(400);
		expect(data.error).toBe('Invalid JSON payload');
	});

	it('returns 400 when connection is missing', async () => {
		const request = makeRequest({ someParam: 'value' });
		const response = await handleElasticRequest(request, vi.fn());
		const data = await response.json();
		expect(response.status).toBe(400);
		expect(data.error).toBe('Connection details required');
	});

	it('returns action result on success', async () => {
		const request = makeRequest({
			connection: { host: 'localhost', port: '9200', useAuth: false },
			index: 'test',
		});
		const action = vi.fn().mockResolvedValue({ count: 42 });
		const response = await handleElasticRequest(request, action);
		const data = await response.json();
		expect(response.status).toBe(200);
		expect(data.data).toEqual({ count: 42 });
		expect(action).toHaveBeenCalled();
	});

	it('passes params (excluding connection) to the action', async () => {
		const request = makeRequest({
			connection: { host: 'localhost', port: '9200', useAuth: false },
			index: 'my-index',
			size: 10,
		});
		const action = vi.fn().mockResolvedValue('ok');
		await handleElasticRequest(request, action);
		const [, params] = action.mock.calls[0];
		expect(params).toEqual({ index: 'my-index', size: 10 });
	});

	it('returns 500 with error reason on action failure', async () => {
		const request = makeRequest({
			connection: { host: 'localhost', port: '9200', useAuth: false },
		});
		const action = vi.fn().mockRejectedValue(new Error('index_not_found'));
		const response = await handleElasticRequest(request, action);
		const data = await response.json();
		expect(response.status).toBe(500);
		expect(data.error).toBe('index_not_found');
	});

	it('extracts nested ES error reason', async () => {
		const request = makeRequest({
			connection: { host: 'localhost', port: '9200', useAuth: false },
		});
		const esError = new Error('ES error');
		esError.meta = {
			body: {
				error: {
					root_cause: [{ reason: 'mapping parse exception' }],
				},
			},
		};
		const action = vi.fn().mockRejectedValue(esError);
		const response = await handleElasticRequest(request, action);
		const data = await response.json();
		expect(data.error).toBe('mapping parse exception');
	});
});
