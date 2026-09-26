import { describe, it, expect, beforeAll, afterAll } from 'vitest';

import { POST as listUsers } from './users/+server.js';
import { POST as putUser } from './user/put/+server.js';
import { POST as deleteUser } from './user/delete/+server.js';
import { POST as setEnabled } from './user/enabled/+server.js';
import { POST as setPassword } from './user/password/+server.js';
import { POST as listRoles } from './roles/+server.js';
import { POST as putRole } from './role/put/+server.js';
import { POST as deleteRole } from './role/delete/+server.js';
import { POST as listKeys } from './api-keys/+server.js';
import { POST as createKey } from './api-key/create/+server.js';
import { POST as invalidateKey } from './api-key/invalidate/+server.js';
import { POST as builtinPrivileges } from './privileges/+server.js';
import { POST as previewQuery } from './query/preview/+server.js';
import { POST as authenticate } from './authenticate/+server.js';

// Exercises the routes against a real cluster, through the real client, so the
// paths and bodies are proven rather than asserted against a mock. Skipped
// unless a cluster is reachable, so it stays out of the way in CI.
const NODE = process.env.ELASTRON_TEST_ES || 'http://localhost:9251';
const connection = (() => {
	const url = new URL(NODE);
	return {
		name: 'probe',
		host: `${url.protocol}//${url.hostname}`,
		port: url.port,
		useAuth: true,
		user: process.env.ELASTRON_TEST_ES_USER || 'elastic',
		password: process.env.ELASTRON_TEST_ES_PASS || 'qwerty',
		version: '8',
	};
})();

const reachable = async () => {
	try {
		const res = await fetch(NODE, {
			headers: { Authorization: 'Basic ' + Buffer.from(`${connection.user}:${connection.password}`).toString('base64') },
			signal: AbortSignal.timeout(2000),
		});
		return res.ok;
	} catch {
		return false;
	}
};

const call = async (handler, params = {}) => {
	const request = new Request('http://localhost/x', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ connection, ...params }),
	});
	const response = await handler({ request });
	return { status: response.status, ...(await response.json()) };
};

const asElastic = (path, method = 'GET', body) =>
	fetch(`${NODE}${path}`, {
		method,
		headers: {
			'Content-Type': 'application/json',
			Authorization: 'Basic ' + Buffer.from(`${connection.user}:${connection.password}`).toString('base64'),
		},
		body: body === undefined ? undefined : JSON.stringify(body),
	});

let live = false;
beforeAll(async () => {
	live = await reachable();
	if (!live) return;

	// These fixtures belong to the tests, not to whatever happens to be on the
	// cluster: the preview cases need documents to count, and the refusal case
	// needs an account that may manage security but not read them.
	await asElastic('/itest-logs/_bulk?refresh=true', 'POST');
	await fetch(`${NODE}/itest-logs/_bulk?refresh=true`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-ndjson',
			Authorization: 'Basic ' + Buffer.from(`${connection.user}:${connection.password}`).toString('base64'),
		},
		body: '{"index":{}}\n{"dept":"eng"}\n{"index":{}}\n{"dept":"eng"}\n{"index":{}}\n{"dept":"sales"}\n',
	});
	await asElastic('/_security/role/itest_sec_only', 'PUT', { cluster: ['manage_security'] });
	await asElastic('/_security/user/itest_secadmin', 'POST', {
		password: 'itestsecadminpassword',
		roles: ['itest_sec_only'],
	});
});

const USER = 'itest_user';
const ROLE = 'itest_role';
const KEY = 'itest_key';

afterAll(async () => {
	if (!live) return;
	await call(deleteUser, { username: USER }).catch(() => {});
	await call(deleteRole, { name: ROLE }).catch(() => {});
	await asElastic('/_security/user/itest_secadmin', 'DELETE').catch(() => {});
	await asElastic('/_security/role/itest_sec_only', 'DELETE').catch(() => {});
	await asElastic('/itest-logs', 'DELETE').catch(() => {});
});

describe('security routes', () => {
	it('lists users, including reserved accounts', async () => {
		if (!live) return;
		const { data } = await call(listUsers);
		expect(Object.keys(data).length).toBeGreaterThan(0);
		expect(Object.values(data).some(u => u.metadata?._reserved)).toBe(true);
	});

	it('creates, edits, disables, re-enables, re-passwords and deletes a user', async () => {
		if (!live) return;
		const created = await call(putUser, { username: USER, body: { password: 'itestpassword1', roles: ['viewer'], full_name: 'Integration' } });
		expect(created.status).toBe(200);

		const edited = await call(putUser, { username: USER, body: { roles: ['viewer'], full_name: 'Renamed', email: 'a@b.c' } });
		expect(edited.status).toBe(200);

		let { data } = await call(listUsers);
		expect(data[USER]).toMatchObject({ full_name: 'Renamed', email: 'a@b.c', enabled: true });

		expect((await call(setEnabled, { username: USER, enabled: false })).status).toBe(200);
		({ data } = await call(listUsers));
		expect(data[USER].enabled).toBe(false);

		expect((await call(setEnabled, { username: USER, enabled: true })).status).toBe(200);
		expect((await call(setPassword, { username: USER, password: 'itestpassword2' })).status).toBe(200);

		expect((await call(deleteUser, { username: USER })).status).toBe(200);
		({ data } = await call(listUsers));
		expect(data[USER]).toBeUndefined();
	});

	it('round-trips a role with cluster privileges and an index block', async () => {
		if (!live) return;
		const body = {
			cluster: ['monitor', 'manage_own_api_key'],
			indices: [{ names: ['logs-*', 'metrics-*'], privileges: ['read', 'view_index_metadata'], allow_restricted_indices: false }],
			run_as: ['someone'],
			metadata: { team: 'platform' },
		};
		expect((await call(putRole, { name: ROLE, body })).status).toBe(200);

		const { data } = await call(listRoles);
		expect(data[ROLE]).toMatchObject({
			cluster: body.cluster,
			indices: body.indices,
			run_as: body.run_as,
			metadata: body.metadata,
		});

		expect((await call(deleteRole, { name: ROLE })).status).toBe(200);
		expect((await call(listRoles)).data[ROLE]).toBeUndefined();
	});

	it('creates an API key returning the secret once, then invalidates it', async () => {
		if (!live) return;
		const { data, status } = await call(createKey, { body: { name: KEY, expiration: '5m' } });
		expect(status).toBe(200);
		expect(data).toMatchObject({ name: KEY });
		expect(typeof data.encoded).toBe('string');

		const listed = await call(listKeys, { owner: true });
		const found = listed.data.api_keys.find(k => k.id === data.id);
		expect(found).toBeDefined();
		expect(JSON.stringify(found)).not.toContain(data.encoded);
		expect(JSON.stringify(found)).not.toContain(data.api_key);

		expect((await call(invalidateKey, { id: data.id })).status).toBe(200);
		const after = await call(listKeys, { owner: true });
		expect(after.data.api_keys.find(k => k.id === data.id).invalidated).toBe(true);
	});

	it('accepts the nested role descriptors the JSON editor produces', async () => {
		if (!live) return;

		// The shape the editor opens with, and a nested one that was awkward to
		// type into the plain textarea this replaced.
		const cases = [
			['itest_desc_default', { restricted: { cluster: ['monitor'] } }],
			[
				'itest_desc_nested',
				{
					reader: {
						cluster: ['monitor'],
						indices: [{ names: ['logs-*'], privileges: ['read', 'view_index_metadata'] }],
					},
				},
			],
		];

		for (const [name, role_descriptors] of cases) {
			const created = await call(createKey, { body: { name, expiration: '5m', role_descriptors } });
			expect(created.status, `${name}: ${created.reason ?? ''}`).toBe(200);

			const listed = await call(listKeys, { owner: true });
			const stored = listed.data.api_keys.find(k => k.id === created.data.id);

			// The cluster echoes descriptors back expanded, with the fields it
			// defaults filled in, so only what was sent is asserted.
			expect(stored.role_descriptors).toMatchObject(role_descriptors);

			await call(invalidateKey, { id: created.data.id });
		}
	});

	it('counts what a block query would expose', async () => {
		if (!live) return;

		const { data, status } = await call(previewQuery, {
			names: ['itest-logs'],
			query: { term: { dept: 'eng' } },
		});

		expect(status).toBe(200);
		expect(data.matching).toBeLessThan(data.total);
		expect(data.total).toBeGreaterThan(0);
	});

	it('reports a query matching nothing, which is valid and usually wrong', async () => {
		if (!live) return;

		const { data } = await call(previewQuery, {
			names: ['itest-logs'],
			query: { term: { never_seen: 'x' } },
		});

		expect(data.matching).toBe(0);
		expect(data.total).toBeGreaterThan(0);
	});

	it('refuses the preview for an account that may manage security but not read', async () => {
		if (!live) return;

		const request = new Request('http://localhost/x', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				connection: { ...connection, user: 'itest_secadmin', password: 'itestsecadminpassword' },
				names: ['itest-logs'],
				query: { match_all: {} },
			}),
		});
		const response = await previewQuery({ request });
		const result = { status: response.status, ...(await response.json()) };

		// The caller treats this as "no preview", not as a failure; the role is
		// still saveable by that account.
		expect(result.status).toBe(500);
		expect(result.cause).toBe('privilege');
	});

	it('returns the cluster own builtin privileges', async () => {
		if (!live) return;
		const { data } = await call(builtinPrivileges);
		expect(data.cluster).toContain('manage_security');
		expect(data.index).toContain('view_index_metadata');
		expect(data.cluster.length).toBeGreaterThan(50);
	});

	it('identifies the connected account', async () => {
		if (!live) return;
		const { data } = await call(authenticate);
		expect(data).toMatchObject({ username: connection.user });
		expect(Array.isArray(data.roles)).toBe(true);
	});

	it('maps a licence refusal rather than echoing the cluster', async () => {
		if (!live) return;

		// Document security needs Platinum or above, so this only applies on a
		// licence that lacks it. A trial cluster accepts the role instead.
		const licence = await fetch(`${NODE}/_license`, {
			headers: { Authorization: 'Basic ' + Buffer.from(`${connection.user}:${connection.password}`).toString('base64') },
		}).then(r => r.json());
		if (!['basic', 'standard', 'gold'].includes(licence.license?.type)) return;

		const res = await call(putRole, {
			name: 'itest_dls',
			body: { indices: [{ names: ['logs-*'], privileges: ['read'], query: '{"term":{"t":"a"}}' }] },
		});
		expect(res.status).toBe(500);
		expect(res.cause).toBe('license');
		expect(res.error).not.toContain('non-compliant');
		expect(res.reason).toContain('non-compliant');
	});
});
