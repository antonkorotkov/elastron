import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createStoreon } from 'storeon';

const putSecurityUser = vi.fn().mockResolvedValue({});
const deleteSecurityUser = vi.fn().mockResolvedValue({});
const setSecurityUserEnabled = vi.fn().mockResolvedValue({});
const changeSecurityUserPassword = vi.fn().mockResolvedValue({});
const getSecurityUsers = vi.fn().mockResolvedValue({});
const getSecurityRolesByName = vi.fn();

// What the cluster holds. Only `superuser` manages security.
const CLUSTER_ROLES = { superuser: { cluster: ['all'] }, viewer: { cluster: [] } };
const answerByName = async names =>
	Object.fromEntries(names.filter(n => CLUSTER_ROLES[n]).map(n => [n, CLUSTER_ROLES[n]]));

vi.mock('../../api/elasticsearch', () => ({
	default: vi.fn(function () {
		return {
			getSecurityUsers,
			putSecurityUser,
			deleteSecurityUser,
			setSecurityUserEnabled,
			changeSecurityUserPassword,
			getSecurityRolesByName,
		};
	}),
}));

const { securityUsers } = await import('./securityUsers');
const { SELF_DELETE_REFUSAL, SELF_DEMOTE_REFUSAL } = await import('../../workspace/security/guards');

const flush = () => new Promise(r => setTimeout(r, 0));

// A minimal stand-in for the surrounding store: identity, and a roles list
// with nothing loaded, since the guard must not depend on loaded rows.
const notifications = [];
const context = (identity = { username: 'admin', roles: ['superuser'] }) => store => {
	store.on('@init', () => ({
		securityIdentity: identity,
		securityRoles: { entries: [] },
	}));
	store.on('notification/add', (_s, n) => {
		notifications.push(n);
	});
};

let store;
beforeEach(() => {
	vi.clearAllMocks();
	getSecurityRolesByName.mockImplementation(answerByName);
	notifications.length = 0;
	store = createStoreon([context(), securityUsers]);
});

describe('user mutations', () => {
	it('sends an ordinary edit', async () => {
		store.dispatch('security/users/put', { username: 'alice', body: { roles: ['viewer'] }, isNew: false });
		await flush();

		expect(putSecurityUser).toHaveBeenCalledWith('alice', { roles: ['viewer'] });
	});

	it('refuses to send an edit that would strip your own managing role', async () => {
		store.dispatch('security/users/put', { username: 'admin', body: { roles: ['viewer'] } });
		await flush();

		expect(putSecurityUser).not.toHaveBeenCalled();
		expect(notifications.at(-1)).toMatchObject({ type: 'error', message: SELF_DEMOTE_REFUSAL });
	});

	it('allows editing yourself while keeping a managing role', async () => {
		store.dispatch('security/users/put', { username: 'admin', body: { roles: ['superuser', 'viewer'] } });
		await flush();

		expect(putSecurityUser).toHaveBeenCalled();
	});

	it('judges the change from the definitions the cluster returns for the roles involved', async () => {
		const custom = createStoreon([context({ username: 'admin', roles: ['sec_admin'] }), securityUsers]);
		getSecurityRolesByName.mockResolvedValue({ sec_admin: { cluster: ['manage_security'] }, viewer: { cluster: [] } });

		custom.dispatch('security/users/put', { username: 'admin', body: { roles: ['viewer'] } });
		await flush();

		expect(getSecurityRolesByName).toHaveBeenCalledWith(['sec_admin', 'viewer']);
		expect(putSecurityUser).not.toHaveBeenCalled();
		expect(notifications.at(-1)).toMatchObject({ message: SELF_DEMOTE_REFUSAL });
	});

	it('refuses keeping only a role the cluster does not describe', async () => {
		const custom = createStoreon([context({ username: 'admin', roles: ['superuser', 'from_roles_yml'] }), securityUsers]);

		custom.dispatch('security/users/put', { username: 'admin', body: { roles: ['from_roles_yml'] } });
		await flush();

		expect(putSecurityUser).not.toHaveBeenCalled();
	});

	it('refuses when the lookup fails and a role that may manage security is removed', async () => {
		const custom = createStoreon([context({ username: 'admin', roles: ['sec_admin'] }), securityUsers]);
		getSecurityRolesByName.mockRejectedValue(new Error('unreachable'));

		custom.dispatch('security/users/put', { username: 'admin', body: { roles: ['viewer'] } });
		await flush();

		expect(putSecurityUser).not.toHaveBeenCalled();
		expect(notifications.at(-1)).toMatchObject({ message: SELF_DEMOTE_REFUSAL });
	});

	it('does not look roles up for an edit of another account', async () => {
		store.dispatch('security/users/put', { username: 'alice', body: { roles: [] } });
		await flush();

		expect(getSecurityRolesByName).not.toHaveBeenCalled();
		expect(putSecurityUser).toHaveBeenCalled();
	});

	it('refuses to send a delete of your own account', async () => {
		store.dispatch('security/users/delete', { username: 'admin' });
		await flush();

		expect(deleteSecurityUser).not.toHaveBeenCalled();
		expect(notifications.at(-1)).toMatchObject({ type: 'error', message: SELF_DELETE_REFUSAL });
	});

	it('sends a delete of anyone else', async () => {
		store.dispatch('security/users/delete', { username: 'alice' });
		await flush();

		expect(deleteSecurityUser).toHaveBeenCalledWith('alice');
	});

	it('reports a refusal from the cluster rather than throwing', async () => {
		putSecurityUser.mockRejectedValueOnce(Object.assign(new Error('nope'), { cause: 'privilege' }));
		store.dispatch('security/users/put', { username: 'alice', body: { roles: [] } });
		await flush();

		expect(notifications.at(-1)).toMatchObject({ type: 'error', message: 'nope' });
	});

	it('toggles enabled and changes a password', async () => {
		store.dispatch('security/users/setEnabled', { username: 'alice', enabled: false });
		store.dispatch('security/users/password', { username: 'alice', password: 'newpassword' });
		await flush();

		expect(setSecurityUserEnabled).toHaveBeenCalledWith('alice', false);
		expect(changeSecurityUserPassword).toHaveBeenCalledWith('alice', 'newpassword');
	});
});
