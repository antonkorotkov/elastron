import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createClient, handleElasticRequest } from './elastic';

// Mock the Client constructor
vi.mock('elasticsearch8', () => {
	return {
		Client: class MockClient8 {
			constructor(opts) {
				this._opts = opts;
				this._version = '8';
				this.close = vi.fn();
			}
		}
	};
});

vi.mock('elasticsearch9', () => {
	return {
		Client: class MockClient9 {
			constructor(opts) {
				this._opts = opts;
				this._version = '9';
				this.close = vi.fn();
			}
		}
	};
});

// Mock the tunnel manager
const mockGetLocalPort = vi.fn().mockReturnValue(null);
vi.mock('./tunnel', () => ({
	tunnelManager: {
		getLocalPort: (...args) => mockGetLocalPort(...args),
	},
}));

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

	it('selects version 9 client when version string starts with 9', () => {
		const client = createClient({
			host: 'localhost',
			version: '9.0.0',
		});
		expect(client._version).toBe('9');
	});

	it('selects the client from a raw elasticsearch version object', () => {
		const client = createClient({
			host: 'localhost',
			version: { number: '9.0.0', build_flavor: 'default' },
		});
		expect(client._version).toBe('9');
	});

	it('defaults to version 8 client for an unusable version value', () => {
		expect(createClient({ host: 'localhost', version: {} })._version).toBe('8');
		expect(createClient({ host: 'localhost', version: 9 })._version).toBe('8');
	});

	it('defaults to version 8 client if version is missing or not 9', () => {
		const client = createClient({
			host: 'localhost',
		});
		expect(client._version).toBe('8');

		const client7 = createClient({
			host: 'localhost',
			version: '7.17.0',
		});
		expect(client7._version).toBe('8'); // Currently defaults to 8 for anything else
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

	it('excludes windowId from params passed to action', async () => {
		const request = makeRequest({
			connection: { host: 'localhost', port: '9200', useAuth: false },
			windowId: 'win-123',
			index: 'my-index',
		});
		const action = vi.fn().mockResolvedValue('ok');
		await handleElasticRequest(request, action);
		const [, params] = action.mock.calls[0];
		expect(params).toEqual({ index: 'my-index' });
		expect(params.windowId).toBeUndefined();
	});

	describe('tunnel-aware routing', () => {
		beforeEach(() => {
			mockGetLocalPort.mockReturnValue(null);
		});

		it('routes through tunnel when useSshTunnel is true and tunnel is active', async () => {
			mockGetLocalPort.mockReturnValue(54321);
			const request = makeRequest({
				connection: {
					host: 'http://es-internal.example.com',
					port: '9200',
					useAuth: false,
					useSshTunnel: true,
				},
				windowId: 'win-1',
			});
			const action = vi.fn().mockResolvedValue('ok');
			await handleElasticRequest(request, action);

			const client = action.mock.calls[0][0];
			expect(client._opts.node).toBe('http://127.0.0.1:54321');
			expect(mockGetLocalPort).toHaveBeenCalledWith('win-1');
		});

		it('uses original host when useSshTunnel is false', async () => {
			const request = makeRequest({
				connection: {
					host: 'http://es.example.com',
					port: '9200',
					useAuth: false,
					useSshTunnel: false,
				},
				windowId: 'win-1',
			});
			const action = vi.fn().mockResolvedValue('ok');
			await handleElasticRequest(request, action);

			const client = action.mock.calls[0][0];
			expect(client._opts.node).toBe('http://es.example.com:9200');
		});

		it('falls back to original host when tunnel is not active', async () => {
			mockGetLocalPort.mockReturnValue(null);
			const request = makeRequest({
				connection: {
					host: 'http://es.example.com',
					port: '9200',
					useAuth: false,
					useSshTunnel: true,
				},
				windowId: 'win-1',
			});
			const action = vi.fn().mockResolvedValue('ok');
			await handleElasticRequest(request, action);

			const client = action.mock.calls[0][0];
			expect(client._opts.node).toBe('http://es.example.com:9200');
		});
	});
});
