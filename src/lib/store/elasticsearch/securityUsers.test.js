import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createStoreon } from 'storeon';

const putSecurityUser = vi.fn().mockResolvedValue({});
const deleteSecurityUser = vi.fn().mockResolvedValue({});
const setSecurityUserEnabled = vi.fn().mockResolvedValue({});
const changeSecurityUserPassword = vi.fn().mockResolvedValue({});
const getSecurityUsers = vi.fn().mockResolvedValue({});

vi.mock('../../api/elasticsearch', () => ({
	default: vi.fn(function () {
		return {
			getSecurityUsers,
			putSecurityUser,
			deleteSecurityUser,
			setSecurityUserEnabled,
			changeSecurityUserPassword,
		};
	}),
}));

const { securityUsers } = await import('./securityUsers');
const { SELF_DELETE_REFUSAL, SELF_DEMOTE_REFUSAL } = await import('../../workspace/security/guards');

const flush = () => new Promise(r => setTimeout(r, 0));

// A minimal stand-in for the surrounding store: identity, the role catalogue
// the guard reads, and a notification sink.
const notifications = [];
const context = () => store => {
	store.on('@init', () => ({
		securityIdentity: { username: 'admin', roles: ['superuser'] },
		securityRoles: { entries: [{ name: 'superuser', cluster: ['all'] }, { name: 'viewer', cluster: [] }] },
	}));
	store.on('notification/add', (_s, n) => {
		notifications.push(n);
	});
};

let store;
beforeEach(() => {
	vi.clearAllMocks();
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
