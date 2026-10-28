import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createStoreon } from 'storeon';

const getSecurityRoleMappings = vi.fn();
const putSecurityRoleMapping = vi.fn().mockResolvedValue({});
const deleteSecurityRoleMapping = vi.fn().mockResolvedValue({});
const getSecurityRolesByName = vi.fn();
const getSecurityUsers = vi.fn();
const whoAmI = vi.fn();

const ADMINS = 'cn=admins,ou=groups,dc=example,dc=com';

// What the cluster holds: one mapping making LDAP admins security managers,
// and one unrelated to the connected account.
const CLUSTER_MAPPINGS = {
	'ldap-admins': { enabled: true, roles: ['ops_admin'], rules: { field: { groups: ADMINS } }, metadata: {} },
	'ldap-sre': { enabled: true, roles: ['ops_admin'], rules: { field: { groups: 'cn=sre,ou=groups,dc=example,dc=com' } }, metadata: {} },
};
const CLUSTER_ROLES = { ops_admin: { cluster: ['manage_security'] } };

const answerMappings = async (names = []) =>
	names.length
		? Object.fromEntries(names.filter(n => CLUSTER_MAPPINGS[n]).map(n => [n, CLUSTER_MAPPINGS[n]]))
		: CLUSTER_MAPPINGS;
const answerRoles = async names =>
	Object.fromEntries(names.filter(n => CLUSTER_ROLES[n]).map(n => [n, CLUSTER_ROLES[n]]));

vi.mock('../../api/elasticsearch', () => ({
	default: vi.fn(function () {
		return {
			getSecurityRoleMappings,
			putSecurityRoleMapping,
			deleteSecurityRoleMapping,
			getSecurityRolesByName,
			getSecurityUsers,
			whoAmI,
		};
	}),
}));

const { securityRoleMappings } = await import('./securityRoleMappings');
const { securityUsers } = await import('./securityUsers');
const { MAPPING_LOCKOUT_REFUSAL, MAPPING_LOCKOUT_WARNING } = await import('../../workspace/security/guards');

const flush = () => new Promise(r => setTimeout(r, 0));

const LDAP_ADMIN = {
	username: 'alice',
	roles: ['ops_admin'],
	authenticationType: 'realm',
	realm: { name: 'ldap1', type: 'ldap' },
	metadata: { ldap_dn: 'cn=alice,dc=example,dc=com', ldap_groups: [ADMINS] },
};

const notifications = [];
const context = identity => store => {
	store.on('@init', () => ({ securityIdentity: identity }));
	store.on('security/identity/update', (s, data) => ({ securityIdentity: { ...s.securityIdentity, ...data } }));
	store.on('notification/add', (_s, n) => {
		notifications.push(n);
	});
};

let store;
const start = (identity = LDAP_ADMIN) => {
	store = createStoreon([context(identity), securityRoleMappings, securityUsers]);
};

beforeEach(() => {
	vi.clearAllMocks();
	getSecurityRoleMappings.mockImplementation(answerMappings);
	getSecurityRolesByName.mockImplementation(answerRoles);
	whoAmI.mockResolvedValue({ username: 'alice', roles: ['ops_admin'] });
	notifications.length = 0;
	start();
});

const errors = () => notifications.filter(n => n.type === 'error').map(n => n.message);

describe('role mapping list', () => {
	it('loads the cluster mappings as entries', async () => {
		store.dispatch('security/roleMappings/fetch');
		await flush();

		const { entries, loaded } = store.get().securityRoleMappings;
		expect(loaded).toBe(true);
		expect(entries.map(e => e.name)).toEqual(['ldap-admins', 'ldap-sre']);
		expect(entries[0].rulesText).toBe(`groups = ${ADMINS}`);
	});

	it('records its own failure without touching the users list', async () => {
		getSecurityRoleMappings.mockRejectedValue(Object.assign(new Error('nope'), { cause: 'privilege' }));
		getSecurityUsers.mockResolvedValue({ alice: { roles: [] } });

		store.dispatch('security/roleMappings/fetch');
		store.dispatch('security/users/fetch');
		await flush();

		expect(store.get().securityRoleMappings.cause).toBe('privilege');
		expect(store.get().securityUsers).toMatchObject({ cause: null, loaded: true });
		expect(store.get().securityUsers.entries).toHaveLength(1);
	});
});

describe('role mapping lockout', () => {
	it('refuses deleting the mapping that makes you an administrator, sending nothing', async () => {
		store.dispatch('security/roleMappings/delete', { name: 'ldap-admins', acknowledged: true });
		await flush();

		expect(deleteSecurityRoleMapping).not.toHaveBeenCalled();
		expect(errors()).toEqual([MAPPING_LOCKOUT_REFUSAL]);
	});

	it('refuses disabling it, and editing it directly so it stops applying', async () => {
		store.dispatch('security/roleMappings/setEnabled', { name: 'ldap-admins', enabled: false });
		store.dispatch('security/roleMappings/put', {
			name: 'ldap-admins',
			body: { enabled: true, roles: ['ops_admin'], rules: { field: { username: 'nobody' } } },
			isNew: false,
		});
		await flush();

		expect(putSecurityRoleMapping).not.toHaveBeenCalled();
		expect(errors()).toEqual([MAPPING_LOCKOUT_REFUSAL, MAPPING_LOCKOUT_REFUSAL]);
	});

	it('deletes a mapping that does not apply to you', async () => {
		store.dispatch('security/roleMappings/delete', { name: 'ldap-sre' });
		await flush();

		expect(deleteSecurityRoleMapping).toHaveBeenCalledWith('ldap-sre');
	});

	it('sends a warned change only once the user has acknowledged it', async () => {
		// A regular expression the guard cannot evaluate, with no other mapping
		// known to keep the account's access.
		const admins = CLUSTER_MAPPINGS['ldap-admins'];
		delete CLUSTER_MAPPINGS['ldap-admins'];
		CLUSTER_MAPPINGS['ldap-regex'] = { enabled: true, roles: ['ops_admin'], rules: { field: { username: '/al.*/' } }, metadata: {} };
		try {
			store.dispatch('security/roleMappings/delete', { name: 'ldap-regex' });
			await flush();
			expect(deleteSecurityRoleMapping).not.toHaveBeenCalled();
			expect(errors()).toEqual([MAPPING_LOCKOUT_WARNING]);

			store.dispatch('security/roleMappings/delete', { name: 'ldap-regex', acknowledged: true });
			await flush();
			expect(deleteSecurityRoleMapping).toHaveBeenCalledWith('ldap-regex');
		} finally {
			delete CLUSTER_MAPPINGS['ldap-regex'];
			CLUSTER_MAPPINGS['ldap-admins'] = admins;
		}
	});

	it('judges from the loaded rows when the cluster mappings cannot be read', async () => {
		store.dispatch('security/roleMappings/fetch');
		await flush();
		getSecurityRoleMappings.mockRejectedValue(new Error('flaky'));

		store.dispatch('security/roleMappings/delete', { name: 'ldap-admins' });
		await flush();

		expect(deleteSecurityRoleMapping).not.toHaveBeenCalled();
		expect(errors()).toEqual([MAPPING_LOCKOUT_REFUSAL]);
	});

	it('reads the account roles afresh rather than trusting those it signed in with', async () => {
		// Signed in holding superuser too, which a mapping deleted since gave it.
		start({ ...LDAP_ADMIN, roles: ['ops_admin', 'superuser'] });

		store.dispatch('security/roleMappings/delete', { name: 'ldap-admins' });
		await flush();
		expect(errors()).toEqual([MAPPING_LOCKOUT_REFUSAL]);

		whoAmI.mockResolvedValue({ username: 'alice', roles: ['ops_admin', 'superuser'] });
		store.dispatch('security/roleMappings/delete', { name: 'ldap-admins' });
		await flush();
		expect(deleteSecurityRoleMapping).toHaveBeenCalledWith('ldap-admins');
	});

	it('leaves a native account alone', async () => {
		start({ username: 'admin', roles: ['superuser'], authenticationType: 'realm', realm: { name: 'native1', type: 'native' } });

		store.dispatch('security/roleMappings/delete', { name: 'ldap-admins' });
		await flush();

		expect(deleteSecurityRoleMapping).toHaveBeenCalledWith('ldap-admins');
		expect(getSecurityRolesByName).not.toHaveBeenCalled();
	});
});

describe('role mapping writes', () => {
	it('will not create a mapping over one that already has the name', async () => {
		store.dispatch('security/roleMappings/put', {
			name: 'ldap-admins',
			body: { enabled: true, roles: ['viewer'], rules: { field: { username: 'x' } } },
			isNew: true,
		});
		await flush();

		expect(putSecurityRoleMapping).not.toHaveBeenCalled();
		expect(errors()).toEqual(['A role mapping named "ldap-admins" already exists.']);
	});

	it('reloads with role definitions once a new cluster says who the account is', async () => {
		start({ username: null, roles: [], authenticationType: null, realm: null, metadata: {} });
		store.dispatch('security/roleMappings/fetch');
		await flush();
		expect(store.get().securityRoleMappings.catalogue).toEqual({});

		store.dispatch('security/identity/update', { ...LDAP_ADMIN, loading: false });
		await flush();
		expect(store.get().securityRoleMappings.catalogue).toEqual(CLUSTER_ROLES);
	});
});

describe('role mapping toggle', () => {
	it('sends the cluster current definition with only enabled changed', async () => {
		start({ username: 'admin', roles: ['superuser'], authenticationType: 'realm', realm: { name: 'native1', type: 'native' } });

		store.dispatch('security/roleMappings/setEnabled', { name: 'ldap-sre', enabled: false });
		await flush();

		expect(putSecurityRoleMapping).toHaveBeenCalledWith('ldap-sre', {
			enabled: false,
			roles: ['ops_admin'],
			rules: CLUSTER_MAPPINGS['ldap-sre'].rules,
		});
		expect(notifications.at(-1)).toMatchObject({ type: 'success', message: 'Role mapping "ldap-sre" disabled.' });
	});

	it('says so when the mapping is gone', async () => {
		store.dispatch('security/roleMappings/setEnabled', { name: 'vanished', enabled: false });
		await flush();

		expect(putSecurityRoleMapping).not.toHaveBeenCalled();
		expect(errors()[0]).toContain('vanished');
	});
});
