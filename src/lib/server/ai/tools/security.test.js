import { describe, it, expect, vi, beforeEach } from 'vitest';
import { forgetWholeLists, readTools } from './read.js';
import {
	TOOL_POLICY,
	buildToolRequest,
	isSecurityWriteRequest,
	describeToolCall,
	needsConfirmation,
	requiresApproval,
} from '../../../ai/catalog.js';
import { toolApproval, toolDefinitions } from './index.js';

const SECURITY_READ_TOOLS = [
	'list-security-users',
	'list-security-roles',
	'list-security-api-keys',
	'get-security-user',
	'get-security-role',
	'get-security-api-key',
];

const LISTINGS = ['list-security-users', 'list-security-roles', 'list-security-api-keys'];

const noQueryEndpoint = () =>
	Object.assign(new Error('no handler'), {
		meta: { statusCode: 400, body: { error: 'no handler found for uri [/_security/_query/role] and method [POST]' } },
	});

// Roles answer as a cluster without the role query would, so the cases that
// feed a whole list also exercise the fallback.
const BUILTIN = {
	cluster: ['all', 'monitor', 'manage_security'],
	index: ['all', 'read', 'write', 'index'],
};

const run = (name, response, input = {}) => {
	const send = vi.fn(request => {
		if (request.path === '/_security/privilege/_builtin') return Promise.resolve(BUILTIN);
		return name === 'list-security-roles' && request.method === 'POST'
			? Promise.reject(noQueryEndpoint())
			: Promise.resolve(response);
	});
	return readTools[name].run(input, send, buildToolRequest(name, input), input);
};

describe('security read tools', () => {
	it.each(SECURITY_READ_TOOLS)('%s is registered and runs without approval', name => {
		expect(toolDefinitions[name]).toBeDefined();
		expect(TOOL_POLICY[name]).toBe('auto');
		expect(needsConfirmation(name)).toBe(false);
		expect(requiresApproval(name, {})).toBe(false);
		if (!LISTINGS.includes(name)) expect(toolApproval[name]).toBeUndefined();
	});

	it.each(LISTINGS)('%s asks before a page after the first', name => {
		expect(requiresApproval(name, { page: 1 })).toBe(false);
		expect(requiresApproval(name, { page: 2 })).toBe(true);
		expect(toolApproval[name]({ page: 2 })).toBe('user-approval');
		expect(describeToolCall(name, { page: 2 })).toMatch(/^Page 2: entries 51–100\./);
	});

	it.each(SECURITY_READ_TOOLS)('%s builds a request that reads', name => {
		expect(isSecurityWriteRequest(buildToolRequest(name))).toBe(false);
	});

	it('summarises users, including whether each is reserved', async () => {
		const result = await run('list-security-users', {
			elastic: { roles: ['superuser'], enabled: true, metadata: { _reserved: true } },
			alice: { roles: ['viewer'], enabled: false, full_name: 'Alice', email: 'a@b.c', metadata: {} },
		});

		expect(result.rows).toEqual([
			{ username: 'alice', roles: ['viewer'], enabled: false, full_name: 'Alice', email: 'a@b.c', reserved: false },
			{ username: 'elastic', roles: ['superuser'], enabled: true, reserved: true },
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

	it('keeps a role whose name collides with a credential field', async () => {
		// The listings are keyed by name, so filtering the top level deleted a
		// role actually called `password` and left the assistant reporting the
		// cluster does not have it.
		const result = await run('list-security-roles', {
			password: { cluster: ['monitor'], indices: [], metadata: {} },
			api_key: { cluster: [], indices: [], metadata: {} },
			ordinary: { cluster: [], indices: [], metadata: {} },
		});

		expect(result.rows.map(r => r.name).sort()).toEqual(['api_key', 'ordinary', 'password']);
	});

	it('keeps a user whose name collides with a credential field', async () => {
		const result = await run('list-security-users', {
			encoded: { roles: ['viewer'], enabled: true, metadata: {} },
		});

		expect(result.rows[0].username).toBe('encoded');
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

	it.each([
		'/_security/user/_has_privileges',
		'/_security/_query/role',
		'/_security/_query/user',
		'/_security/_query/api_key',
		'/_security/_authenticate',
	])('treats the read-only POST %s as a read', path => {
		// Refusing these told the user the assistant may not change security,
		// which is not what it was being asked to do.
		expect(isSecurityWriteRequest({ method: 'POST', path })).toBe(false);
	});

	it.each([
		'/%5Fsecurity/user/bob',
		'/%5fsecurity/user/bob',
		'/%255Fsecurity/user/bob',
		'//_security/user/bob',
		'_security/user/bob',
		'/_security/user/bob?refresh=true',
		'/_security%2Fuser%2Fbob',
	])('refuses a write however the path %s is spelled', path => {
		expect(isSecurityWriteRequest({ method: 'PUT', path })).toBe(true);
	});

	it('still refuses a POST under _security it does not recognise as a read', () => {
		expect(isSecurityWriteRequest({ method: 'POST', path: '/_security/oidc/authenticate' })).toBe(true);
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

describe('looking up users and roles by name', () => {
	const lookUp = (name, input, send) => readTools[name].run(input, send, buildToolRequest(name, input), input);
	const notFound = () => Object.assign(new Error('not found'), { meta: { statusCode: 404 } });

	it.each(['get-security-user', 'get-security-role'])('%s runs without approval', name => {
		expect(TOOL_POLICY[name]).toBe('auto');
		expect(requiresApproval(name, {})).toBe(false);
	});

	it('asks for several names in one request', () => {
		expect(buildToolRequest('get-security-user', { usernames: ['alice', 'bob'] })).toEqual({
			method: 'GET',
			path: '/_security/user/alice,bob',
		});
		expect(buildToolRequest('get-security-role', { names: ['ops', 'viewer'] })).toEqual({
			method: 'GET',
			path: '/_security/role/ops,viewer',
		});
	});

	it('keeps a slash inside the name, so it cannot reach another endpoint', () => {
		const { path } = buildToolRequest('get-security-role', { names: ['../../_cluster/health'] });
		expect(path).toBe('/_security/role/..%2F..%2F_cluster%2Fhealth');
		expect(isSecurityWriteRequest({ method: 'GET', path })).toBe(false);
	});

	it('refuses an empty list and more than 20 names', () => {
		const schema = readTools['get-security-role'].inputSchema;
		expect(schema.safeParse({ names: [] }).success).toBe(false);
		expect(schema.safeParse({ names: Array.from({ length: 21 }, (_, i) => `r${i}`) }).success).toBe(false);
		expect(schema.safeParse({ names: ['ops'] }).success).toBe(true);
	});

	it('returns the roles that exist and names the ones that do not', async () => {
		const send = vi.fn().mockResolvedValue({ ops: { cluster: ['monitor'] } });
		const result = await lookUp('get-security-role', { names: ['ops', 'no_such_role'] }, send);

		expect(result).toEqual({ found: { ops: { cluster: ['monitor'] } }, missing: ['no_such_role'] });
	});

	it('says none exist, rather than failing, when the cluster answers 404', async () => {
		const send = vi.fn().mockRejectedValue(notFound());
		const result = await lookUp('get-security-user', { usernames: ['nobody'] }, send);

		expect(result).toMatchObject({ found: {}, missing: ['nobody'] });
		expect(result.note).toMatch(/None of the requested users exist/);
	});

	it('passes other failures on', async () => {
		const send = vi.fn().mockRejectedValue(Object.assign(new Error('forbidden'), { meta: { statusCode: 403 } }));
		await expect(lookUp('get-security-user', { usernames: ['alice'] }, send)).rejects.toThrow('forbidden');
	});

	it('returns what a role restricts, which the listing only flags', async () => {
		const tenant = {
			cluster: [],
			indices: [
				{
					names: ['assets'],
					privileges: ['read'],
					query: '{"term":{"holder":"a"}}',
					field_security: { grant: ['*'], except: ['secret'] },
				},
			],
			metadata: {},
		};
		const result = await lookUp('get-security-role', { names: ['tenant'] }, vi.fn().mockResolvedValue({ tenant }));

		expect(result.found.tenant.indices[0]).toEqual(tenant.indices[0]);
	});

	it('strips credential fields from each record but keeps a user named like one', async () => {
		const send = vi.fn().mockResolvedValue({ password: { roles: ['viewer'], password_hash: 'x' } });
		const result = await lookUp('get-security-user', { usernames: ['password'] }, send);

		expect(result.found).toEqual({ password: { roles: ['viewer'] } });
		expect(result.missing).toEqual([]);
	});
});

describe('looking up API keys', () => {
	const bodyFor = input => buildToolRequest('get-security-api-key', input).body;
	const filters = input => bodyFor(input).query.bool.filter;

	it('queries the key search, newest first', () => {
		const request = buildToolRequest('get-security-api-key', { name: 'ci-deploy' });
		expect(request).toMatchObject({ method: 'POST', path: '/_security/_query/api_key' });
		expect(request.body.sort).toEqual([{ creation: { order: 'desc' } }, { name: { order: 'asc' } }]);
	});

	it.each([
		[{ id: 'abc' }, [{ ids: { values: ['abc'] } }]],
		[{ name: 'ci-*' }, [{ wildcard: { name: { value: 'ci-*', case_insensitive: true } } }]],
		[{ username: 'bob' }, [{ term: { username: 'bob' } }]],
		[
			{ name: 'ci-*', username: 'bob' },
			[{ wildcard: { name: { value: 'ci-*', case_insensitive: true } } }, { term: { username: 'bob' } }],
		],
	])('filters on %j and leaves invalidated keys out', (input, expected) => {
		expect(filters(input)).toEqual([...expected, { term: { invalidated: false } }]);
	});

	it('includes invalidated keys when asked', () => {
		expect(filters({ username: 'bob', include_invalidated: true })).toEqual([{ term: { username: 'bob' } }]);
	});

	it('refuses a lookup with no identifier, so it never becomes a listing', () => {
		const schema = readTools['get-security-api-key'].inputSchema;
		expect(schema.safeParse({}).success).toBe(false);
		expect(schema.safeParse({ include_invalidated: true }).success).toBe(false);
		expect(schema.safeParse({ username: 'bob' }).success).toBe(true);
	});

	it('returns the full records without any secret', async () => {
		const key = {
			id: 'k1',
			name: 'ci-deploy',
			username: 'bob',
			creation: 1,
			invalidated: false,
			role_descriptors: { r: { cluster: ['monitor'] } },
			api_key: 'SECRET',
			encoded: 'SECRET',
		};
		const send = vi.fn().mockResolvedValue({ total: 1, count: 1, api_keys: [key] });
		const result = await readTools['get-security-api-key'].run({ name: 'ci-deploy' }, send, buildToolRequest('get-security-api-key', { name: 'ci-deploy' }));

		expect(JSON.stringify(result)).not.toContain('SECRET');
		expect(result.keys[0]).toMatchObject({ name: 'ci-deploy', role_descriptors: { r: { cluster: ['monitor'] } } });
	});

	it('says when nothing matches', async () => {
		const send = vi.fn().mockResolvedValue({ total: 0, count: 0, api_keys: [] });
		const result = await readTools['get-security-api-key'].run({ name: 'zzz' }, send, {});
		expect(result).toMatchObject({ total: 0, keys: [], note: 'No API key matches.' });
	});
});

describe('searching and paging the security listings', () => {
	const users = Object.fromEntries(
		Array.from({ length: 120 }, (_, i) => [`user${String(i).padStart(3, '0')}`, { roles: ['viewer'], enabled: true, metadata: {} }])
	);
	users.bob = { roles: ['ops'], email: 'bob@example.com', full_name: 'Bob B', enabled: true, metadata: {} };
	users.elastic = { roles: ['superuser'], enabled: true, metadata: { _reserved: true } };

	it('finds a user by email, counting only the matches', async () => {
		const result = await run('list-security-users', users, { search: 'BOB@example' });
		expect(result).toMatchObject({ total: 1, page: 1, pages: 1 });
		expect(result.rows.map(u => u.username)).toEqual(['bob']);
	});

	it('finds users by role name and keeps reserved users', async () => {
		expect((await run('list-security-users', users, { search: 'superuser' })).rows).toEqual([
			{ username: 'elastic', roles: ['superuser'], enabled: true, reserved: true },
		]);
	});

	it('pages users and says how to reach the next page', async () => {
		const first = await run('list-security-users', users);
		expect(first).toMatchObject({ total: 122, page: 1, pages: 3, returned: 50, truncated: true });
		const third = await run('list-security-users', users, { page: 3 });
		expect(third.returned).toBe(22);
	});

	const role = (name, extra = {}) => ({ name, cluster: [], indices: [], metadata: {}, ...extra });

	it('asks the cluster for one page of roles when only searching', async () => {
		const request = buildToolRequest('list-security-roles', { search: 'Ops', page: 3 });
		expect(request).toMatchObject({ method: 'POST', path: '/_security/_query/role' });
		expect(request.body).toMatchObject({ from: 100, size: 50, sort: [{ name: { order: 'asc' } }] });
		expect(request.body.query.bool.should[0]).toEqual({ wildcard: { name: { value: '*Ops*', case_insensitive: true } } });
	});

	it('reads every role when filtering by index or privilege', () => {
		expect(buildToolRequest('list-security-roles', { index: 'logs-1' })).toEqual({ method: 'GET', path: '/_security/role' });
		expect(buildToolRequest('list-security-roles', { privilege: 'write' })).toEqual({ method: 'GET', path: '/_security/role' });
	});

	it('reports the cluster total when the cluster pages', async () => {
		const send = vi.fn().mockResolvedValue({ total: 7279, count: 1, roles: [{ ...role('ops'), _sort: ['ops'] }] });
		const result = await readTools['list-security-roles'].run({}, send, buildToolRequest('list-security-roles'));
		expect(result).toMatchObject({ total: 7279, pages: 146, truncated: true });
		expect(result.rows[0]).not.toHaveProperty('_sort');
	});

	it('answers a search the same way on a cluster without the role query', async () => {
		const all = {
			Team_ops: role('Team_ops'),
			billing: role('billing', { description: 'Billing team readers' }),
			other: role('other'),
		};
		const bySearch = async search => (await run('list-security-roles', all, { search })).rows.map(r => r.name);
		expect(await bySearch('TEAM')).toEqual(['Team_ops', 'billing']);
		expect(await bySearch('ops')).toEqual(['Team_ops']);
		expect(await bySearch('team billing')).toEqual(['billing']);
		expect(await bySearch('')).toEqual(['Team_ops', 'billing', 'other']);
	});

	it('finds the roles that grant write on an index, among every role', async () => {
		const all = Object.fromEntries(
			Array.from({ length: 300 }, (_, i) => [`r${String(i).padStart(3, '0')}`, role(`r${i}`, { indices: [{ names: ['metrics-*'], privileges: ['read'] }] })])
		);
		all.r250 = role('r250', { indices: [{ names: ['logs-*'], privileges: ['write'] }] });
		all.reader = role('reader', { indices: [{ names: ['logs-*'], privileges: ['read'] }, { names: ['x'], privileges: ['write'] }] });
		all.superuser = role('superuser', { indices: [{ names: ['*'], privileges: ['all'] }] });

		const result = await run('list-security-roles', all, { index: 'logs-2026.09', privilege: 'write' });
		expect(result.rows.map(r => r.name)).toEqual(['r250', 'superuser']);
		expect(result.total).toBe(2);
	});

	it('lists API keys newest first, leaving invalidated keys out', () => {
		const { body } = buildToolRequest('list-security-api-keys', { page: 2 });
		expect(body).toMatchObject({ from: 50, size: 50, sort: [{ creation: { order: 'desc' } }, { name: { order: 'asc' } }] });
		expect(body.query.bool.filter).toEqual([{ term: { invalidated: false } }]);
		expect(buildToolRequest('list-security-api-keys', { include_invalidated: true }).body.query.bool.filter).toEqual([]);
	});

	it('searches API keys by name, taking wildcard characters literally, or by exact owner', () => {
		const { must } = buildToolRequest('list-security-api-keys', { search: 'ci*' }).body.query.bool;
		expect(must[0].bool.should).toEqual([
			{ wildcard: { name: { value: '*ci\\**', case_insensitive: true } } },
			{ term: { username: 'ci*' } },
		]);
	});
});

describe('the listings point the model at the lookups', () => {
	it.each([
		['list-security-users', 'get-security-user'],
		['list-security-roles', 'get-security-role'],
		['list-security-api-keys', 'get-security-api-key'],
	])('%s says its rows are summaries and names %s', (listing, lookup) => {
		const { description } = readTools[listing];
		expect(description).toMatch(/Rows are summaries/);
		expect(description).toContain(lookup);
		expect(description).toMatch(/later page needs the user's approval/);
	});
});

describe('pages the user approved run as approved', () => {
	const roleListOf = n =>
		Object.fromEntries(Array.from({ length: n }, (_, i) => [`r${String(i).padStart(3, '0')}`, { cluster: [], indices: [], metadata: {} }]));

	it('falls back on page 1, which has no card, and says how to ask for later pages', async () => {
		const result = await run('list-security-roles', roleListOf(120), {});
		expect(result).toMatchObject({ total: 120, pages: 3 });
		expect(result.note).toMatch(/pass source whole_list when asking for later pages/);
	});

	it('does not swap an approved later page for a different request', async () => {
		const send = vi.fn().mockRejectedValue(noQueryEndpoint());
		const input = { page: 2 };
		await expect(readTools['list-security-roles'].run(input, send, buildToolRequest('list-security-roles', input))).rejects.toThrow(
			/source whole_list/
		);
		expect(send).toHaveBeenCalledTimes(1);
		expect(send.mock.calls[0][0].method).toBe('POST');
	});

	it('shows the whole-list read on the card when asked for it', () => {
		expect(buildToolRequest('list-security-roles', { source: 'whole_list', page: 2 })).toEqual({
			method: 'GET',
			path: '/_security/role',
		});
	});

	it('pages the whole list here when asked', async () => {
		const input = { source: 'whole_list', page: 3 };
		const send = vi.fn().mockResolvedValue(roleListOf(120));
		const result = await readTools['list-security-roles'].run(input, send, buildToolRequest('list-security-roles', input));
		expect(result).toMatchObject({ page: 3, returned: 20 });
		expect(send.mock.calls.every(([request]) => request.method === 'GET')).toBe(true);
	});
});

describe('the cluster result window', () => {
	it.each(['list-security-roles', 'list-security-api-keys'])('%s answers page 201 with a note instead of a refused request', async name => {
		const send = vi.fn();
		const input = { page: 201 };
		const result = await readTools[name].run(input, send, buildToolRequest(name, input));
		expect(send).not.toHaveBeenCalled();
		expect(result).toMatchObject({ page: 201, returned: 0, rows: [] });
		expect(result.note).toMatch(/first 10000 entries, so page 201 cannot be fetched/);
	});

	it('still fetches page 200, the last one inside the window', async () => {
		const send = vi.fn().mockResolvedValue({ total: 12000, api_keys: [] });
		const input = { page: 200 };
		const result = await readTools['list-security-api-keys'].run(input, send, buildToolRequest('list-security-api-keys', input));
		expect(send.mock.calls[0][0].body.from).toBe(9950);
		expect(result.note).toMatch(/Only the first 10000 of 12000 can be paged this way/);
	});
});

describe('reusing a whole list across pages', () => {
	beforeEach(() => forgetWholeLists());

	const labelled = (answer, connectionKey = 'es|9200|elastic|1') =>
		Object.assign(vi.fn().mockResolvedValue(answer), { connectionKey });

	it('reads the role list once while the pages of a filtered listing are walked', async () => {
		const roles = { r: { cluster: [], indices: [{ names: ['logs-*'], privileges: ['write'] }], metadata: {} } };
		const send = labelled(roles);
		for (const page of [1, 2, 3]) {
			const input = { index: 'logs-1', page };
			await readTools['list-security-roles'].run(input, send, buildToolRequest('list-security-roles', input));
		}
		expect(send).toHaveBeenCalledTimes(1);
	});

	it('does not share a list between clusters or accounts', async () => {
		const users = { alice: { roles: [], metadata: {} } };
		const first = labelled(users, 'a|9200|elastic|1');
		const second = labelled(users, 'b|9200|elastic|1');
		await readTools['list-security-users'].run({}, first, buildToolRequest('list-security-users'));
		await readTools['list-security-users'].run({}, second, buildToolRequest('list-security-users'));
		expect(first).toHaveBeenCalledTimes(1);
		expect(second).toHaveBeenCalledTimes(1);
	});

	it('reads again after a failed read, rather than remembering the failure', async () => {
		const send = Object.assign(
			vi.fn().mockRejectedValueOnce(new Error('unreachable')).mockResolvedValue({ alice: { roles: [], metadata: {} } }),
			{ connectionKey: 'es|9200|elastic|1' }
		);
		await expect(readTools['list-security-users'].run({}, send, buildToolRequest('list-security-users'))).rejects.toThrow();
		const result = await readTools['list-security-users'].run({}, send, buildToolRequest('list-security-users'));
		expect(result.rows[0].username).toBe('alice');
	});
});

describe('the privilege filter keeps cluster and index privileges apart', () => {
	const all = {
		sandbox_owner: { cluster: [], indices: [{ names: ['sandbox'], privileges: ['all'] }], metadata: {} },
		cluster_admin: { cluster: ['all'], indices: [], metadata: {} },
		security_admin: { cluster: ['manage_security'], indices: [], metadata: {} },
		writer: { cluster: [], indices: [{ names: ['logs-*'], privileges: ['write'] }], metadata: {} },
	};
	const names = async input => (await run('list-security-roles', all, input)).rows.map(r => r.name);

	it('does not count an index all as manage_security', async () => {
		expect(await names({ privilege: 'manage_security' })).toEqual(['cluster_admin', 'security_admin']);
	});

	it('does not count a cluster all as write', async () => {
		expect(await names({ privilege: 'write' })).toEqual(['sandbox_owner', 'writer']);
	});
});
