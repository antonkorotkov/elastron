import { describe, it, expect, vi } from 'vitest';
import { readTools } from './read.js';
import {
	TOOL_POLICY,
	buildToolRequest,
	isSecurityWriteRequest,
	needsConfirmation,
	requiresApproval,
} from '../../../ai/catalog.js';
import { toolApproval, toolDefinitions } from './index.js';

const SECURITY_READ_TOOLS = ['list-security-users', 'list-security-roles', 'list-security-api-keys'];

const run = (name, response) => {
	const send = vi.fn().mockResolvedValue(response);
	return readTools[name].run({}, send, buildToolRequest(name), {});
};

describe('security read tools', () => {
	it.each(SECURITY_READ_TOOLS)('%s is registered and runs without approval', name => {
		expect(toolDefinitions[name]).toBeDefined();
		expect(TOOL_POLICY[name]).toBe('auto');
		expect(needsConfirmation(name)).toBe(false);
		expect(requiresApproval(name, {})).toBe(false);
		expect(toolApproval[name]).toBeUndefined();
	});

	it.each(SECURITY_READ_TOOLS)('%s builds a GET request', name => {
		expect(buildToolRequest(name).method).toBe('GET');
	});

	it('summarises users, including whether each is reserved', async () => {
		const result = await run('list-security-users', {
			elastic: { roles: ['superuser'], enabled: true, metadata: { _reserved: true } },
			alice: { roles: ['viewer'], enabled: false, full_name: 'Alice', email: 'a@b.c', metadata: {} },
		});

		expect(result.rows).toEqual([
			{ username: 'elastic', roles: ['superuser'], enabled: true, reserved: true },
			{ username: 'alice', roles: ['viewer'], enabled: false, full_name: 'Alice', email: 'a@b.c', reserved: false },
		]);
	});

	it('tells the model which roles restrict documents or fields', async () => {
		const result = await run('list-security-roles', {
			tenant: {
				cluster: ['monitor'],
				indices: [
					{ names: ['assets'], privileges: ['read'], query: '{"term":{}}' },
					{ names: ['logs'], privileges: ['read'], field_security: { grant: ['a'] } },
				],
				metadata: {},
			},
		});

		expect(result.rows[0].indices).toEqual([
			{ names: ['assets'], privileges: ['read'], restricts_documents: true, restricts_fields: false },
			{ names: ['logs'], privileges: ['read'], restricts_documents: false, restricts_fields: true },
		]);
	});

	it('returns API key metadata and no secret', async () => {
		const result = await run('list-security-api-keys', {
			api_keys: [
				{
					id: 'k1',
					name: 'ingest',
					username: 'elastic',
					creation: 1,
					expiration: 2,
					invalidated: false,
					// A shape a future Elasticsearch could return.
					api_key: 'raw-secret-value',
					encoded: 'encoded-secret-value',
				},
			],
		});

		const serialised = JSON.stringify(result);
		expect(serialised).not.toContain('raw-secret-value');
		expect(serialised).not.toContain('encoded-secret-value');
		expect(result.rows[0]).toMatchObject({ id: 'k1', name: 'ingest', username: 'elastic' });
	});

	it('strips credential fields wherever they appear', async () => {
		const result = await run('list-security-users', {
			alice: { roles: ['viewer'], enabled: true, password_hash: '$2a$hash', metadata: { password: 'nested' } },
		});

		expect(JSON.stringify(result)).not.toContain('$2a$hash');
		expect(JSON.stringify(result)).not.toContain('nested');
	});
});

describe('the assistant has no security write tool', () => {
	it('offers nothing that creates, changes, or deletes security state', () => {
		const writeish = Object.keys(toolDefinitions).filter(
			name => /security/.test(name) && !SECURITY_READ_TOOLS.includes(name)
		);
		expect(writeish).toEqual([]);
	});

	it('never builds a security write request from a named tool', () => {
		for (const name of Object.keys(TOOL_POLICY)) {
			const request = buildToolRequest(name, { index: 'i', id: 'x', body: {}, query: {} });
			if (request) expect(isSecurityWriteRequest(request)).toBe(false);
		}
	});
});

describe('isSecurityWriteRequest', () => {
	it.each([
		['PUT', '/_security/user/alice', true],
		['POST', '/_security/user/alice', true],
		['DELETE', '/_security/role/r', true],
		['POST', '/_security/api_key', true],
		['DELETE', '/_security/api_key', true],
		['PUT', '/_security/user/alice/_password', true],
		['PUT', '/_security/user/alice/_disable', true],
		['PUT', '/_security/role_mapping/m', true],
		['GET', '/_security/user', false],
		['GET', '/_security/role', false],
		['GET', '/_security/api_key', false],
		['GET', '/logs-2024/_search', false],
		['DELETE', '/logs-2024', false],
	])('%s %s -> %s', (method, path, expected) => {
		expect(isSecurityWriteRequest({ method, path })).toBe(expected);
	});

	it('errs toward refusing a security POST it cannot prove is a read', () => {
		expect(isSecurityWriteRequest({ method: 'POST', path: '/_security/_query/role' })).toBe(true);
	});
});

// --- Execution-level refusal --------------------------------------------
// The named tools cannot express a security write, so the generic request
// tool is the only route to one. These run through createAssistantTools so
// the refusal is proven where it actually happens.
const es = vi.hoisted(() => ({ request: null }));

vi.mock('../../elastic.js', async importOriginal => ({
	...(await importOriginal()),
	withElasticClient: vi.fn(async (_connection, _windowId, fn) =>
		fn({ transport: { request: es.request } })
	),
}));

const { createAssistantTools } = await import('./index.js');

describe('the generic request tool refuses security writes', () => {
	const exec = (name, input) => {
		es.request = vi.fn(async () => ({ acknowledged: true }));
		const tools = createAssistantTools({ connection: { host: 'http://es' }, windowId: 'w' });
		return { promise: tools[name].execute(input, { toolCallId: 'c', messages: [] }), sent: () => es.request.mock.calls };
	};

	it.each([
		['PUT', '/_security/user/alice', { password: 'hunter2', roles: ['superuser'] }],
		['DELETE', '/_security/role/log_reader', undefined],
		['POST', '/_security/api_key', { name: 'k' }],
		['PUT', '/_security/user/alice/_password', { password: 'x' }],
	])('refuses %s %s without sending it', async (method, path, body) => {
		const { promise, sent } = exec('run-es-request', { method, path, body });

		await expect(promise).rejects.toThrow(/not available to the assistant/);
		expect(sent()).toHaveLength(0);
	});

	it('points the user at the Security area rather than just refusing', async () => {
		const { promise } = exec('run-es-request', { method: 'PUT', path: '/_security/user/x', body: {} });
		await expect(promise).rejects.toThrow(/Security area/);
	});

	it('still allows reading security state through the generic tool', async () => {
		const { promise, sent } = exec('run-es-request', { method: 'GET', path: '/_security/role' });

		await expect(promise).resolves.toBeDefined();
		expect(sent()).toHaveLength(1);
	});

	it('leaves ordinary index requests alone', async () => {
		const { promise, sent } = exec('run-es-request', { method: 'DELETE', path: '/logs-2024' });

		await expect(promise).resolves.toBeDefined();
		expect(sent()).toHaveLength(1);
	});

	it('runs the security read tools without approval', async () => {
		es.request = vi.fn(async () => ({}));
		const tools = createAssistantTools({ connection: { host: 'http://es' }, windowId: 'w' });

		await expect(
			tools['list-security-users'].execute({}, { toolCallId: 'c', messages: [] })
		).resolves.toBeDefined();
	});
});
