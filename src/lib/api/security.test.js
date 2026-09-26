import { describe, it, expect, beforeEach, vi } from 'vitest';
import API from './elasticsearch';

const connection = { name: 'probe', host: 'http://localhost', port: '9200' };
const windowId = 'win-1';

const okResponse = data => ({ ok: true, json: async () => ({ data }) });

let fetchMock;
beforeEach(() => {
	fetchMock = vi.fn().mockResolvedValue(okResponse({ ok: true }));
	vi.stubGlobal('fetch', fetchMock);
});

const sent = () => {
	const [url, init] = fetchMock.mock.calls.at(-1);
	return { url, body: JSON.parse(init.body) };
};

describe('security API client', () => {
	const api = () => new API(connection, windowId);

	it.each([
		['whoAmI', [], '/api/elastic/security/authenticate', {}],
		['getBuiltinPrivileges', [], '/api/elastic/security/privileges', {}],
		['getSecurityUsers', [], '/api/elastic/security/users', {}],
		['putSecurityUser', ['alice', { roles: ['viewer'] }], '/api/elastic/security/user/put', { username: 'alice', body: { roles: ['viewer'] } }],
		['deleteSecurityUser', ['alice'], '/api/elastic/security/user/delete', { username: 'alice' }],
		['setSecurityUserEnabled', ['alice', false], '/api/elastic/security/user/enabled', { username: 'alice', enabled: false }],
		['changeSecurityUserPassword', ['alice', 'pw'], '/api/elastic/security/user/password', { username: 'alice', password: 'pw' }],
		['getSecurityRoles', [], '/api/elastic/security/roles', {}],
		['putSecurityRole', ['r', { cluster: ['monitor'] }], '/api/elastic/security/role/put', { name: 'r', body: { cluster: ['monitor'] } }],
		['deleteSecurityRole', ['r'], '/api/elastic/security/role/delete', { name: 'r' }],
		['getSecurityApiKeys', [true], '/api/elastic/security/api-keys', { owner: true }],
		['createSecurityApiKey', [{ name: 'k' }], '/api/elastic/security/api-key/create', { body: { name: 'k' } }],
		['invalidateSecurityApiKey', ['id-1'], '/api/elastic/security/api-key/invalidate', { id: 'id-1' }],
	])('%s posts to its route with the connection and window id', async (method, args, url, payload) => {
		await api()[method](...args);

		expect(sent().url).toBe(url);
		expect(sent().body).toMatchObject({ ...payload, connection, windowId });
	});

	it('carries a classified cause off a failed security route', async () => {
		fetchMock.mockResolvedValue({
			ok: false,
			json: async () => ({
				error: "This feature is not available because the cluster's licence does not cover it.",
				cause: 'license',
				reason: 'current license is non-compliant for [field and document level security]',
			}),
		});

		await expect(api().putSecurityRole('r', {})).rejects.toMatchObject({
			cause: 'license',
			reason: 'current license is non-compliant for [field and document level security]',
		});
	});

	it('does not wrap a security failure into a ConnectionError', async () => {
		fetchMock.mockResolvedValue({ ok: false, json: async () => ({ error: 'nope', cause: 'privilege' }) });
		await expect(api().getSecurityUsers()).rejects.toMatchObject({ cause: 'privilege' });
	});
});
