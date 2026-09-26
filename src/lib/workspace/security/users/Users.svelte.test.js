// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/svelte';

const rowFor = async name => within((await screen.findByText(name)).closest('tr'));

const state = vi.hoisted(() => ({
	users: null,
	roles: null,
	identity: null,
	dispatch: null,
	open: null,
}));

vi.mock('@storeon/svelte', () => {
	const { writable: w } = require('svelte/store');
	state.users = w({ entries: [], loaded: true, loading: false, cause: null, message: '', reason: '', search: '', sorting: [] });
	state.roles = w({ entries: [], loaded: true });
	state.identity = w({ username: 'elastic', roles: ['superuser'] });
	return {
		useStoreon: () => ({
			dispatch: (...a) => state.dispatch(...a),
			app: w({ theme: 'light' }),
			securityUsers: state.users,
			securityRoles: state.roles,
			securityIdentity: state.identity,
		}),
	};
});

vi.mock('svelte', async importOriginal => {
	const actual = await importOriginal();
	return { ...actual, getContext: () => ({ open: (...a) => state.open(...a) }) };
});

import Users from './Users.svelte';

const USERS = [
	{ username: 'elastic', roles: ['superuser'], enabled: true, reserved: true },
	{ username: 'alice', roles: ['log_reader'], full_name: 'Alice Ng', email: 'alice@example.com', enabled: true, reserved: false },
	{ username: 'carol', roles: ['sec_admin'], full_name: 'Carol Diaz', enabled: false, reserved: false },
];

beforeEach(() => {
	window.__IS_TEST__ = true;
	state.dispatch = vi.fn();
	state.open = vi.fn();
	state.roles.set({ entries: [{ name: 'superuser', cluster: ['all'] }, { name: 'log_reader', cluster: [] }], loaded: true });
	state.identity.set({ username: 'elastic', roles: ['superuser'] });
	state.users.set({ entries: USERS, loaded: true, loading: false, cause: null, message: '', reason: '', search: '', sorting: [] });
});

describe('Users surface', () => {
	it('lists both reserved and native accounts', async () => {
		render(Users);

		expect(await screen.findByText('alice')).toBeTruthy();
		expect(await screen.findByText('elastic')).toBeTruthy();
		expect(screen.getByText('reserved').classList.contains('label')).toBe(true);
		expect(screen.getByText('3 items')).toBeTruthy();
	});

	it('fetches users, and the role catalogue the guard needs, on mount', () => {
		state.roles.set({ entries: [], loaded: false });
		render(Users);

		expect(state.dispatch).toHaveBeenCalledWith('security/users/fetch');
		expect(state.dispatch).toHaveBeenCalledWith('security/roles/fetch');
	});

	it('offers only a password change on a reserved account', async () => {
		state.users.set({
			entries: [USERS[0]],
			loaded: true, loading: false, cause: null, message: '', reason: '', search: '', sorting: [],
		});
		render(Users);

		await screen.findByText('elastic');
		expect(screen.getByTitle('Change password')).toBeTruthy();
		expect(screen.queryByTitle('Edit user')).toBeNull();
		expect(screen.queryByTitle('Delete user')).toBeNull();
		expect(screen.queryByTitle(/able user/)).toBeNull();
	});

	it('offers the full set on a native account', async () => {
		state.identity.set({ username: 'admin', roles: ['superuser'] });
		render(Users);

		const alice = await rowFor('alice');
		expect(alice.getByTitle('Edit user')).toBeTruthy();
		expect(alice.getByTitle('Delete user')).toBeTruthy();
		expect(alice.getByTitle('Disable user')).toBeTruthy();
	});

	it('withholds delete on the account the connection signs in as', async () => {
		state.users.set({
			entries: [{ username: 'elastic', roles: ['superuser'], enabled: true, reserved: false }],
			loaded: true, loading: false, cause: null, message: '', reason: '', search: '', sorting: [],
		});
		render(Users);

		await screen.findByText('elastic');
		expect(screen.getByTitle('Edit user')).toBeTruthy();
		expect(screen.queryByTitle('Delete user')).toBeNull();
	});

	it('deletes a user after the confirmation is accepted', async () => {
		state.identity.set({ username: 'admin', roles: ['superuser'] });
		vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));
		render(Users);

		const alice = await rowFor('alice');
		await fireEvent.click(alice.getByTitle('Delete user'));

		expect(state.dispatch).toHaveBeenCalledWith('security/users/delete', { username: 'alice' });
	});

	it('shows the cause instead of the table when the listing was refused', () => {
		state.users.set({
			entries: [], loaded: true, loading: false,
			cause: 'privilege', message: 'no', reason: 'unauthorized', search: '', sorting: [],
		});
		render(Users);

		expect(document.querySelector('[data-cause="privilege"]')).toBeTruthy();
	});
});

describe('the roles column', () => {
	it('caps a user holding many roles, keeping the row to one line', async () => {
		state.users.set({
			entries: [
				{
					username: 'busy',
					roles: Array.from({ length: 40 }, (_, i) => `role_${i}`),
					enabled: true,
					reserved: false,
				},
			],
			loaded: true, loading: false, cause: null, message: '', reason: '', search: '', sorting: [],
		});
		render(Users);

		await screen.findByText('busy');
		const cell = screen.getByText('busy').closest('tr').querySelectorAll('td')[1];

		expect(cell.querySelector('.listed').textContent).toBe('role_0, role_1, role_2');
		expect(cell.querySelector('.more').textContent.trim()).toBe('+37');
	});

	it('says so plainly when a user holds none', async () => {
		state.users.set({
			entries: [{ username: 'nobody', roles: [], enabled: true, reserved: false }],
			loaded: true, loading: false, cause: null, message: '', reason: '', search: '', sorting: [],
		});
		render(Users);

		await screen.findByText('nobody');
		expect(screen.getByText('nobody').closest('tr').querySelectorAll('td')[1].textContent.trim()).toBe('none');
	});

	it('still finds a user by a role the cell does not show', () => {
		state.users.set({
			entries: [
				{ username: 'busy', roles: Array.from({ length: 40 }, (_, i) => `role_${i}`), enabled: true, reserved: false },
			],
			loaded: true, loading: false, cause: null, message: '', reason: '', search: 'role_31', sorting: [],
		});
		render(Users);

		expect(screen.getByText('1 item')).toBeTruthy();
		expect(screen.getByText('busy')).toBeTruthy();
	});
});
