// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/svelte';

/**
 * The security screens are new, and the app's look comes from conventions that
 * live in markup rather than in a shared component: dialogs rely on the modal
 * shell's own `.ui.header` / `.content` / `.actions` blocks, which is where the
 * dark-mode rules are, and every themed element carries `inverted`. These tests
 * pin those down so the screens cannot drift away from the rest of the app.
 */

const theme = vi.hoisted(() => ({ value: 'dark' }));

vi.mock('@storeon/svelte', () => {
	const { writable, derived } = require('svelte/store');
	const themeStore = writable({ theme: theme.value });
	return {
		useStoreon: () => ({
			dispatch: vi.fn(),
			app: derived(themeStore, () => ({ theme: theme.value })),
			securityUsers: writable({ entries: [], loaded: true, loading: false, cause: null, message: '', reason: '', search: '', sorting: [] }),
			securityRoles: writable({ entries: [], loaded: true, loading: false, cause: null, message: '', reason: '', search: '', sorting: [] }),
			securityApiKeys: writable({ entries: [], loaded: true, loading: false, cause: null, message: '', reason: '', search: '', sorting: [], scope: 'all' }),
			securityIdentity: writable({ username: 'admin', roles: ['superuser'] }),
			securityPrivileges: writable({ cluster: ['monitor'], index: ['read'], remote_cluster: [], loaded: true }),
		}),
	};
});

vi.mock('svelte', async importOriginal => {
	const actual = await importOriginal();
	return { ...actual, getContext: () => ({ open: vi.fn(), close: vi.fn() }) };
});

vi.mock('$lib/components/JsonEditor.svelte', async () => ({
	default: (await import('./__JsonEditorStub.svelte')).default,
}));

const UserDialog = (await import('./users/UserDialog.svelte')).default;
const PasswordDialog = (await import('./users/PasswordDialog.svelte')).default;
const RoleDialog = (await import('./roles/RoleDialog.svelte')).default;
const CreateApiKeyDialog = (await import('./api-keys/CreateApiKeyDialog.svelte')).default;

const Users = (await import('./users/Users.svelte')).default;
const Roles = (await import('./roles/Roles.svelte')).default;
const ApiKeys = (await import('./api-keys/ApiKeys.svelte')).default;

const DIALOGS = [
	['UserDialog', UserDialog, { username: null }],
	['PasswordDialog', PasswordDialog, { username: 'alice' }],
	['RoleDialog', RoleDialog, { name: null }],
	['CreateApiKeyDialog', CreateApiKeyDialog, {}],
];

const SURFACES = [
	['Users', Users],
	['Roles', Roles],
	['ApiKeys', ApiKeys],
];

beforeEach(() => {
	window.__IS_TEST__ = true;
	theme.value = 'dark';
});

describe.each(DIALOGS)('%s follows the modal conventions', (_name, Component, props) => {
	beforeEach(() => render(Component, { props }));

	it('uses the modal shell blocks rather than its own body wrapper', () => {
		// Modal.svelte styles exactly these three for dark mode. A dialog that
		// invents its own container gets none of that.
		expect(document.querySelector('.ui.header')).toBeTruthy();
		expect(document.querySelector('.content')).toBeTruthy();
		expect(document.querySelector('.actions')).toBeTruthy();
		expect(document.querySelector('.modal-body')).toBeNull();
	});

	it('titles itself in the app title case, not a bare heading tag', () => {
		const header = document.querySelector('.ui.header').textContent.trim();
		expect(header.length).toBeGreaterThan(0);
		expect(document.querySelector('h3')).toBeNull();
	});

	it('puts its form in the content and its buttons in the actions', () => {
		const form = document.querySelector('.content .ui.form');
		expect(form).toBeTruthy();
		expect(document.querySelector('.actions .ui.button, .actions button.ui')).toBeTruthy();
	});

	it('carries the green confirm button the other dialogs use', () => {
		const confirm = document.querySelector('.actions .ui.green.button, .actions .ui.green.right.button');
		expect(confirm).toBeTruthy();
	});

	it('applies inverted to the form and the action buttons in dark mode', () => {
		expect(document.querySelector('.content .ui.form').classList.contains('inverted')).toBe(true);
		for (const button of document.querySelectorAll('.actions .ui.button')) {
			expect(button.classList.contains('inverted')).toBe(true);
		}
	});
});

describe('choosing from a cluster-sourced list', () => {
	const { readFileSync } = require('node:fs');

	// A cluster can report hundreds of roles and 60-odd privileges, with names
	// long enough to overlap in a grid. Anything sourced from the cluster is
	// picked through the app's searchable dropdown, not a wall of checkboxes.
	it.each([
		['users/UserDialog.svelte', 'Roles'],
		['roles/RoleDialog.svelte', 'Cluster Privileges'],
		['roles/RoleDialog.svelte', 'Privileges'],
	])('%s picks %s through the shared dropdown', file => {
		const source = readFileSync(`src/lib/workspace/security/${file}`, 'utf8');

		expect(source).toContain('AdvancedDropdown');
		expect(source).toContain('multiple');
		expect(source).not.toMatch(/grid-template-columns/);
	});
});

describe.each(SURFACES)('%s follows the dashboard list conventions', (_name, Component) => {
	beforeEach(() => render(Component));

	it('puts the table directly in the segments block, not inside a segment', () => {
		// A wrapping segment would add its padding around the table; on the
		// dashboard the table is a sibling of the toolbar segment.
		const segments = document.querySelector('.ui.segments');
		expect(segments).toBeTruthy();
		expect(segments.querySelector(':scope > .scrollable')).toBeTruthy();
		expect(segments.querySelector(':scope > .ui.segment .scrollable')).toBeNull();
	});

	it('uses the shared toolbar grid with a count and a search input', () => {
		expect(document.querySelector('.ui.segment .ui.grid .eight.wide.column')).toBeTruthy();
		expect(document.querySelector('.ui.horizontal.list .ui.grey.text')).toBeTruthy();
		expect(document.querySelector('.ui.search .ui.icon.input input.prompt')).toBeTruthy();
	});

	it('inverts the toolbar segment and the search input in dark mode', () => {
		expect(document.querySelector('.ui.segment').classList.contains('inverted')).toBe(true);
		expect(document.querySelector('.ui.search .ui.icon.input').classList.contains('inverted')).toBe(true);
	});

	it('adds no message banners of its own', () => {
		// The app used one message box before this feature. Status that is not a
		// blocking failure belongs in the toolbar or the notification tray.
		expect(document.querySelectorAll('.ui.message')).toHaveLength(0);
	});
});
