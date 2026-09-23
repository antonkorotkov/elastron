// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';

const state = vi.hoisted(() => ({ roles: null, dispatch: null, open: null }));

vi.mock('@storeon/svelte', () => {
	const { writable } = require('svelte/store');
	state.roles = writable({ entries: [], loaded: true, loading: false, cause: null, message: '', reason: '', search: '', sorting: [] });
	return {
		useStoreon: () => ({
			dispatch: (...a) => state.dispatch(...a),
			app: writable({ theme: 'light' }),
			securityRoles: state.roles,
		}),
	};
});

vi.mock('svelte', async importOriginal => {
	const actual = await importOriginal();
	return { ...actual, getContext: () => ({ open: (...a) => state.open(...a) }) };
});

// The name cell carries the labels and the row actions, the way the indices
// table does, so it renders as part of the surface under test.

import Roles from './Roles.svelte';

// Machine-named roles with a document query, the way a real cluster has them.
const many = n =>
	Array.from({ length: n }, (_, i) => ({
		name: `acc_role_${String(i).padStart(4, '0')}`,
		cluster: [],
		indices: [{ names: [`tenant-${i}-*`], privileges: ['read'], query: '{"term":{}}' }],
		reserved: false,
		hasDocumentQuery: true,
		hasFieldSecurity: false,
	}));

const setRoles = (entries, extra = {}) =>
	state.roles.set({ entries, loaded: true, loading: false, cause: null, message: '', reason: '', search: '', sorting: [], ...extra });

beforeEach(() => {
	window.__IS_TEST__ = true;
	state.dispatch = vi.fn();
	state.open = vi.fn();
	setRoles([]);
});

describe('Roles surface', () => {
	it('fetches roles and the cluster privilege names on mount', () => {
		render(Roles);
		expect(state.dispatch).toHaveBeenCalledWith('security/roles/fetch');
		expect(state.dispatch).toHaveBeenCalledWith('security/privileges/fetch');
	});

	// jsdom renders every row (VirtualTable's test fallback), so these use a
	// modest list. The search case below is the one that proves the derived
	// rows span entries the real virtualiser would never have mounted.
	it('counts the whole list, not the rendered window', () => {
		setRoles(many(60));
		render(Roles);
		expect(screen.getByText('60 items')).toBeTruthy();
	});

	it('searches across every entry, including ones far outside the rendered window', () => {
		setRoles(many(300), { search: 'tenant-287-' });
		render(Roles);

		// The match is the 288th entry; a window-only search would miss it.
		expect(screen.getByText('1 item')).toBeTruthy();
		expect(screen.getByText('acc_role_0287')).toBeTruthy();
	});

	it('sorts across the whole list so the first row is the global first', () => {
		setRoles(many(60), { sorting: ['desc', 'Role', 0] });
		render(Roles);

		const first = document.querySelector('tbody tr[data-index="0"] td').textContent.trim();
		expect(first.startsWith('acc_role_0059')).toBe(true);
	});

	it('shows the in-progress state, not an empty list, while the first load runs', () => {
		setRoles([], { loaded: false, loading: true });
		render(Roles);

		expect(screen.getByTestId('security-list-loading')).toBeTruthy();
		expect(screen.queryByText('No roles found')).toBeNull();
	});

	it('keeps the rows on screen while a refresh runs', async () => {
		setRoles(many(3), { loaded: true, loading: true });
		render(Roles);

		expect(screen.queryByTestId('security-list-loading')).toBeNull();
		expect(await screen.findByText('acc_role_0000')).toBeTruthy();
	});

	it('says the cluster has no roles only once a load has completed', async () => {
		setRoles([], { loaded: true, loading: false });
		render(Roles);

		expect(await screen.findByText('No roles found')).toBeTruthy();
	});

	// Shaped like `kibana_system`, which grants hundreds of index patterns and
	// two dozen cluster privileges. Printing them all made one row taller than
	// the window and wrecked the virtualised table.
	const sprawling = () => [
		{
			name: 'kibana_system',
			cluster: Array.from({ length: 24 }, (_, i) => `cluster_priv_${i}`),
			indices: [
				{ names: Array.from({ length: 200 }, (_, i) => `.pattern-${i}-*`), privileges: ['read'] },
				{ names: ['.pattern-0-*', 'logs-*'], privileges: ['read'] },
			],
			run_as: [],
			reserved: true,
			hasDocumentQuery: false,
			hasFieldSecurity: false,
		},
	];

	it('shows only the first few index patterns, with the rest behind a count', async () => {
		setRoles(sprawling());
		render(Roles);

		await screen.findByText('kibana_system');
		const row = screen.getByText('kibana_system').closest('tr');
		const indices = row.querySelectorAll('td')[2];

		expect(indices.querySelector('.listed').textContent).toBe('.pattern-0-*, .pattern-1-*, .pattern-2-*');
		// 200 patterns plus `logs-*`; the duplicate is not counted twice.
		expect(indices.querySelector('.more').textContent.trim()).toBe('+198');
	});

	it('caps the cluster privileges the same way', async () => {
		setRoles(sprawling());
		render(Roles);

		await screen.findByText('kibana_system');
		const privileges = screen.getByText('kibana_system').closest('tr').querySelectorAll('td')[1];

		expect(privileges.querySelector('.listed').textContent).toBe('cluster_priv_0, cluster_priv_1, cluster_priv_2');
		expect(privileges.querySelector('.more').textContent.trim()).toBe('+21');
	});

	it('keeps every row to a single line, whatever the role grants', async () => {
		setRoles(sprawling());
		render(Roles);

		await screen.findByText('kibana_system');
		const row = screen.getByText('kibana_system').closest('tr');

		// A cell that wraps is what made the row explode; each list cell holds
		// at most three values and a count.
		for (const cell of [...row.querySelectorAll('td')].slice(1)) {
			const listed = cell.querySelector('.listed');
			if (listed) expect(listed.textContent.split(', ')).toHaveLength(3);
		}
	});

	it('names the hidden values in the count tooltip, itself capped', async () => {
		setRoles(sprawling());
		render(Roles);

		await screen.findByText('kibana_system');
		const more = screen.getByText('kibana_system').closest('tr').querySelectorAll('td')[2].querySelector('.more');
		const title = more.getAttribute('title');

		expect(title).toContain('.pattern-3-*');
		expect(title.split('\n').length).toBeLessThanOrEqual(16);
		expect(title).toMatch(/Open the role to see them all/);
	});

	it('still finds a role by a pattern the cell does not show', () => {
		setRoles(sprawling(), { search: '.pattern-150-' });
		render(Roles);

		expect(screen.getByText('1 item')).toBeTruthy();
		expect(screen.getByText('kibana_system')).toBeTruthy();
	});

	it('shows a dash rather than an empty cell when a role grants nothing', async () => {
		setRoles([{ name: 'empty_role', cluster: [], indices: [], run_as: [], reserved: false, hasDocumentQuery: false, hasFieldSecurity: false }]);
		render(Roles);

		await screen.findByText('empty_role');
		const cells = screen.getByText('empty_role').closest('tr').querySelectorAll('td');
		expect(cells[1].textContent.trim()).toBe('—');
	});

	it('does not add a count when everything already fits', async () => {
		setRoles([{ name: 'small', cluster: ['monitor'], indices: [{ names: ['logs-*'], privileges: ['read'] }], run_as: [], reserved: false, hasDocumentQuery: false, hasFieldSecurity: false }]);
		render(Roles);

		await screen.findByText('small');
		expect(screen.getByText('small').closest('tr').querySelector('.more')).toBeNull();
	});

	it('labels a role that restricts documents, since the name says nothing', () => {
		setRoles(many(1));
		render(Roles);

		const label = screen.getByText('documents');
		expect(label.classList.contains('label')).toBe(true);
	});

	it('marks a reserved role and offers viewing but not editing or deleting', async () => {
		setRoles([{ name: 'superuser', cluster: ['all'], indices: [], run_as: [], reserved: true, hasDocumentQuery: false, hasFieldSecurity: false }]);
		render(Roles);

		await screen.findByText('superuser');
		expect(screen.getByText('reserved').classList.contains('label')).toBe(true);
		expect(screen.getByTitle('View role')).toBeTruthy();
		expect(screen.queryByTitle('Edit role')).toBeNull();
		expect(screen.queryByTitle('Delete role')).toBeNull();
	});

	it('offers edit and delete on a custom role', async () => {
		setRoles(many(1));
		render(Roles);

		await screen.findByText('acc_role_0000');
		expect(screen.getByTitle('Edit role')).toBeTruthy();
		expect(screen.getByTitle('Delete role')).toBeTruthy();
	});

	it('leaves the list alone when a delete confirmation is dismissed', async () => {
		setRoles(many(1));
		vi.stubGlobal('confirm', vi.fn().mockReturnValue(false));
		render(Roles);

		await screen.findByText('acc_role_0000');
		await fireEvent.click(screen.getByTitle('Delete role'));

		expect(state.dispatch).not.toHaveBeenCalledWith('security/roles/delete', expect.anything());
	});

	it('deletes after the confirmation is accepted', async () => {
		setRoles(many(1));
		vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));
		render(Roles);

		await screen.findByText('acc_role_0000');
		await fireEvent.click(screen.getByTitle('Delete role'));

		expect(state.dispatch).toHaveBeenCalledWith('security/roles/delete', { name: 'acc_role_0000' });
	});
});
