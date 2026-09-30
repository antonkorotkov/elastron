// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';

const api = vi.hoisted(() => ({ byName: null }));

vi.mock('@storeon/svelte', () => {
	const { writable } = require('svelte/store');
	return {
		useStoreon: () => ({
			dispatch: vi.fn(),
			app: writable({ theme: 'light' }),
			connection: writable({ host: 'http://es', port: '9200' }),
			// Deliberately empty: the dialog must not depend on loaded rows.
			securityRoles: writable({ entries: [] }),
			securityPrivileges: writable({ cluster: ['monitor'], index: ['read'], remote_cluster: [], loaded: true }),
		}),
	};
});

vi.mock('svelte', async importOriginal => {
	const actual = await importOriginal();
	return { ...actual, getContext: () => ({ close: vi.fn() }) };
});

vi.mock('$lib/api/elasticsearch', () => ({
	default: vi.fn(function () {
		return { getSecurityRolesByName: (...a) => api.byName(...a) };
	}),
}));

vi.mock('$lib/components/JsonEditor.svelte', async () => ({
	default: (await import('../__JsonEditorStub.svelte')).default,
}));

import RoleDialog from './RoleDialog.svelte';

beforeEach(() => {
	api.byName = vi.fn();
});

describe('RoleDialog', () => {
	it('loads a role that is not among the loaded rows, with its full definition', async () => {
		api.byName.mockResolvedValue({
			far_away: { cluster: ['monitor'], indices: [], applications: [{ application: 'app', privileges: ['all'], resources: ['*'] }] },
		});
		render(RoleDialog, { props: { name: 'far_away' } });

		expect(screen.getByTestId('role-loading')).toBeTruthy();
		expect(await screen.findByText('Edit far_away')).toBeTruthy();
		expect(api.byName).toHaveBeenCalledWith(['far_away']);
		expect(screen.getByText(/This role also sets applications/)).toBeTruthy();
	});

	it('opens a reserved role read-only', async () => {
		api.byName.mockResolvedValue({ superuser: { cluster: ['all'], metadata: { _reserved: true } } });
		render(RoleDialog, { props: { name: 'superuser' } });

		expect(await screen.findByText('superuser (reserved)')).toBeTruthy();
	});

	it('says so when the role has been deleted since the list was loaded', async () => {
		api.byName.mockResolvedValue({});
		render(RoleDialog, { props: { name: 'gone' } });

		expect(await screen.findByText('This role no longer exists on the cluster.')).toBeTruthy();
	});

	it('reports a failed load instead of opening an empty editor', async () => {
		api.byName.mockRejectedValue(new Error('The cluster could not be reached.'));
		render(RoleDialog, { props: { name: 'r' } });

		expect(await screen.findByText('The cluster could not be reached.')).toBeTruthy();
		expect(screen.queryByText('Save')).toBeNull();
	});

	it('creates a new role without loading anything', () => {
		render(RoleDialog, { props: { name: null } });

		expect(screen.getByText('Create New Role')).toBeTruthy();
		expect(api.byName).not.toHaveBeenCalled();
	});
});
