import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import { createClient } from './elastic';

// Uses the real bundled clients against a local server, so what is asserted is
// what goes over the wire rather than what the client was configured with.
let server;
let port;
const received = [];

beforeAll(async () => {
	server = http.createServer((req, res) => {
		received.push(req.headers);
		res.writeHead(200, { 'content-type': 'application/json', 'x-elastic-product': 'Elasticsearch' });
		res.end('{}');
	});
	await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
	port = server.address().port;
});

afterAll(() => new Promise(resolve => server.close(resolve)));

const sendWith = async (version, connection) => {
	received.length = 0;
	const client = createClient({ host: 'http://127.0.0.1', port, version, ...connection });
	try {
		await client.transport.request({ method: 'GET', path: '/' });
	} finally {
		await client.close();
	}
	return received[0];
};

describe.each([['8'], ['9']])('connection headers with the v%s client', version => {
	it('sends a mixed-case connection header once', async () => {
		const headers = await sendWith(version, {
			addHeaders: true,
			headers: [{ name: 'X-Custom', value: 'foo' }],
		});

		expect(headers['x-custom']).toBe('foo');
	});

	it('lets a connection Authorization header replace basic auth', async () => {
		const headers = await sendWith(version, {
			useAuth: true,
			user: 'elastic',
			password: 'secret',
			addHeaders: true,
			headers: [{ name: 'Authorization', value: 'Bearer token' }],
		});

		expect(headers.authorization).toBe('Bearer token');
	});
});
