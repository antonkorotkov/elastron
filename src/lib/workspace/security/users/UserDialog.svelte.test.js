// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import { tick } from 'svelte';

const state = vi.hoisted(() => ({ users: null, roles: null, identity: null, dispatch: null, close: null }));

vi.mock('@storeon/svelte', () => {
	const { writable } = require('svelte/store');
	state.users = writable({ entries: [] });
	state.roles = writable({ entries: [] });
	state.identity = writable({ username: 'admin', roles: ['superuser'] });
	return {
		useStoreon: () => ({
			dispatch: (...a) => state.dispatch(...a),
			app: writable({ theme: 'light' }),
			securityUsers: state.users,
			securityRoles: state.roles,
			securityIdentity: state.identity,
		}),
	};
});

vi.mock('svelte', async importOriginal => {
	const actual = await importOriginal();
	return { ...actual, getContext: () => ({ close: (...a) => state.close(...a) }) };
});

// svelte-select scrolls the hovered option into view; jsdom has no layout and
// so no scrollIntoView. Selection behaviour is what these tests exercise.
Element.prototype.scrollIntoView ??= () => {};

import UserDialog from './UserDialog.svelte';

// A cluster like the real one: hundreds of roles with generated names that are
// far too long to read in a grid of checkboxes.
const generated = n =>
	Array.from({ length: n }, (_, i) => ({
		name: `acc_role_${i.toString(16).padStart(32, '0')}`,
		cluster: [],
	}));

const ROLES = [...generated(300), { name: 'superuser', cluster: ['all'] }, { name: 'viewer', cluster: [] }];

const field = label => screen.getByText(label).closest('.field');

const openList = async label => {
	const f = field(label);
	f.querySelector('.svelte-select').dispatchEvent(new Event('pointerup', { bubbles: true }));
	await tick();
	return f;
};

const typeIn = async (label, text) => {
	const f = await openList(label);
	await fireEvent.input(f.querySelector('.svelte-select input'), { target: { value: text } });
	await tick();
	return f;
};

const options = f => [...f.querySelectorAll('.svelte-select-list .item')].map(el => el.textContent.trim());

const pick = async (label, option) => {
	const f = await typeIn(label, option);
	await fireEvent.click([...f.querySelectorAll('.svelte-select-list .list-item')].find(el => el.textContent.trim() === option));
	await new Promise(r => setTimeout(r, 0));
	await tick();
};

beforeEach(() => {
	state.dispatch = vi.fn();
	state.close = vi.fn();
	state.roles.set({ entries: ROLES });
	state.users.set({ entries: [] });
	state.identity.set({ username: 'admin', roles: ['superuser'] });
});

describe('the roles selector', () => {
	it('does not render one control per role', () => {
		render(UserDialog, { props: { username: null } });

		// The grid of checkboxes this replaced put 300 labels on screen at once,
		// overlapping each other once the names got long.
		expect(document.querySelectorAll('input[type="checkbox"]')).toHaveLength(0);
		expect(field('Roles').querySelector('.svelte-select')).toBeTruthy();
	});

	it('narrows a long list by typing', async () => {
		render(UserDialog, { props: { username: null } });

		const f = await typeIn('Roles', 'superuser');
		expect(options(f)).toEqual(['superuser']);
	});

	it('adds a role to the selection', async () => {
		render(UserDialog, { props: { username: null } });

		await fireEvent.input(screen.getByLabelText('Username'), { target: { value: 'alice' } });
		await fireEvent.input(screen.getByLabelText(/Password/), { target: { value: 'longenough' } });
		await pick('Roles', 'viewer');
		await fireEvent.click(screen.getByText('Create'));

		const call = state.dispatch.mock.calls.find(c => c[0] === 'security/users/put');
		expect(call[1].body.roles).toEqual(['viewer']);
	});

	it('keeps roles the user already had and adds to them', async () => {
		state.users.set({ entries: [{ username: 'bob', roles: ['viewer'], enabled: true }] });
		render(UserDialog, { props: { username: 'bob' } });

		await pick('Roles', 'superuser');
		await fireEvent.click(screen.getByText('Save'));

		const call = state.dispatch.mock.calls.find(c => c[0] === 'security/users/put');
		expect(call[1].body.roles).toEqual(['viewer', 'superuser']);
	});

	it('reports how many are selected, since the chips can overflow', async () => {
		state.users.set({ entries: [{ username: 'bob', roles: ['viewer', 'superuser'], enabled: true }] });
		render(UserDialog, { props: { username: 'bob' } });

		expect(screen.getByText('2 selected')).toBeTruthy();
	});

	it('still refuses an edit that strips the account own managing role', async () => {
		state.identity.set({ username: 'bob', roles: ['superuser'] });
		state.users.set({ entries: [{ username: 'bob', roles: ['superuser'], enabled: true }] });
		render(UserDialog, { props: { username: 'bob' } });

		// Nothing is wrong until the managing role is actually taken away.
		expect(screen.queryByText(/without any role/)).toBeNull();

		await fireEvent.click(field('Roles').querySelector('.clear-select'));
		await tick();

		expect(screen.getByText(/without any role/)).toBeTruthy();
		expect(screen.getByText('Save').disabled).toBe(true);
	});

	it('says so when the cluster reported no roles', () => {
		state.roles.set({ entries: [] });
		render(UserDialog, { props: { username: null } });

		expect(document.querySelector('.svelte-select input').getAttribute('placeholder')).toMatch(/No roles/);
	});
});
