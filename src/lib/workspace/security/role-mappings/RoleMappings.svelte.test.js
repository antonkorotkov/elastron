// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/svelte';
import { toRoleMappingEntries } from '$lib/store/elasticsearch/securityList.js';

const rowFor = async name => within((await screen.findByText(name)).closest('tr'));

const state = vi.hoisted(() => ({
	mappings: null,
	identity: null,
	dispatch: null,
	open: null,
}));

vi.mock('@storeon/svelte', () => {
	const { writable: w } = require('svelte/store');
	state.mappings = w({ entries: [], catalogue: {}, loaded: true, loading: false, cause: null, message: '', reason: '', search: '', sorting: [] });
	state.identity = w({ username: 'elastic', roles: ['superuser'] });
	return {
		useStoreon: () => ({
			dispatch: (...a) => state.dispatch(...a),
			app: w({ theme: 'light' }),
			securityRoleMappings: state.mappings,
			securityIdentity: state.identity,
		}),
	};
});

vi.mock('svelte', async importOriginal => {
	const actual = await importOriginal();
	return { ...actual, getContext: () => ({ open: (...a) => state.open(...a) }) };
});

import RoleMappings from './RoleMappings.svelte';

const OPS = 'cn=ops,ou=groups,dc=example,dc=com';
const ADMINS = 'cn=admins,ou=groups,dc=example,dc=com';

const MAPPINGS = toRoleMappingEntries({
	'ldap-ops': {
		enabled: true,
		roles: ['viewer'],
		rules: { all: [{ field: { 'realm.name': 'ldap1' } }, { field: { groups: OPS } }] },
		metadata: {},
	},
	'ldap-admins': { enabled: true, roles: ['ops_admin'], rules: { field: { groups: ADMINS } }, metadata: {} },
	tpl: {
		enabled: false,
		role_templates: [{ template: '{"source":"{{#tojson}}groups{{/tojson}}"}', format: 'json' }],
		rules: { field: { 'realm.name': 'saml1' } },
		metadata: {},
	},
	'operator-admins-read-only-operator-mapping': {
		enabled: true,
		roles: ['superuser'],
		rules: { field: { groups: ADMINS } },
		metadata: { _read_only: true },
	},
});

const LDAP_ALICE = {
	username: 'alice',
	roles: ['ops_admin'],
	authenticationType: 'realm',
	realm: { name: 'ldap1', type: 'ldap' },
	metadata: { ldap_dn: 'cn=alice,dc=example,dc=com', ldap_groups: [ADMINS] },
};

const list = (extra = {}) => ({
	entries: MAPPINGS,
	catalogue: {},
	loaded: true,
	loading: false,
	cause: null,
	message: '',
	reason: '',
	search: '',
	sorting: [],
	...extra,
});

beforeEach(() => {
	window.__IS_TEST__ = true;
	state.dispatch = vi.fn();
	state.open = vi.fn();
	state.identity.set({ username: 'elastic', roles: ['superuser'], authenticationType: 'realm', realm: { name: 'reserved', type: 'reserved' } });
	state.mappings.set(list());
	vi.restoreAllMocks();
});

describe('Role mappings surface', () => {
	it('lists the mappings with their roles and rules, and fetches on mount', async () => {
		render(RoleMappings);

		const row = await rowFor('ldap-ops');
		expect(row.getByText('viewer')).toBeTruthy();
		expect(row.getByText(`realm.name = ldap1 AND groups = ${OPS}`)).toBeTruthy();
		expect(screen.getByText('4 items')).toBeTruthy();
		expect(state.dispatch).toHaveBeenCalledWith('security/roleMappings/fetch');
	});

	it('says that file-based mappings are not shown', () => {
		render(RoleMappings);
		expect(screen.getByText('File-based mappings not shown').getAttribute('title')).toMatch(/role mapping file/);
	});

	it('finds the mapping for a group by part of its DN', async () => {
		state.mappings.set(list({ search: 'ou=groups,dc=example' }));
		render(RoleMappings);

		expect(await screen.findByText('ldap-ops')).toBeTruthy();
		expect(screen.queryByText('tpl')).toBeNull();
	});

	it('marks a template mapping instead of listing roles', async () => {
		render(RoleMappings);
		const row = await rowFor('tpl');
		expect(row.getByText('template').getAttribute('title')).toContain('tojson');
	});

	it('offers only viewing on a read-only mapping', async () => {
		render(RoleMappings);
		const row = await rowFor('operator-admins-read-only-operator-mapping');

		expect(row.getByText('read-only').classList.contains('label')).toBe(true);
		expect(row.getByTitle('View role mapping')).toBeTruthy();
		expect(row.queryByTitle('Edit role mapping')).toBeNull();
		expect(row.queryByTitle('Disable role mapping')).toBeNull();
		expect(row.queryByTitle('Delete role mapping')).toBeNull();
	});

	it('deletes after a confirmation naming the mapping, and not when cancelled', async () => {
		const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
		render(RoleMappings);
		const row = await rowFor('ldap-ops');

		await fireEvent.click(row.getByTitle('Delete role mapping'));
		expect(confirm.mock.calls[0][0]).toContain('"ldap-ops"');
		expect(state.dispatch).not.toHaveBeenCalledWith('security/roleMappings/delete', expect.anything());

		confirm.mockReturnValue(true);
		await fireEvent.click(row.getByTitle('Delete role mapping'));
		expect(state.dispatch).toHaveBeenCalledWith('security/roleMappings/delete', { name: 'ldap-ops', acknowledged: false });
	});

	it('toggles a mapping without a prompt when nothing is at stake', async () => {
		render(RoleMappings);
		const row = await rowFor('tpl');

		await fireEvent.click(row.getByTitle('Enable role mapping'));
		expect(state.dispatch).toHaveBeenCalledWith('security/roleMappings/setEnabled', { name: 'tpl', enabled: true, acknowledged: false });
	});

	it('hides delete and disable on the mapping that makes you an administrator', async () => {
		state.identity.set(LDAP_ALICE);
		const catalogue = { ops_admin: { cluster: ['manage_security'] }, viewer: { cluster: [] } };
		// Without the operator mapping, which also makes admins superusers.
		state.mappings.set(list({ entries: MAPPINGS.filter(m => !m.readOnly), catalogue }));
		const { unmount } = render(RoleMappings);

		const admins = await rowFor('ldap-admins');
		expect(admins.getByTitle('Edit role mapping')).toBeTruthy();
		expect(admins.queryByTitle('Delete role mapping')).toBeNull();
		expect(admins.queryByTitle('Disable role mapping')).toBeNull();
		expect((await rowFor('ldap-ops')).getByTitle('Delete role mapping')).toBeTruthy();
		unmount();

		// With it, the account keeps its access whichever way ldap-admins goes.
		state.mappings.set(list({ catalogue }));
		render(RoleMappings);
		expect((await rowFor('ldap-admins')).getByTitle('Delete role mapping')).toBeTruthy();
	});

	it('carries the warning into the prompt and acknowledges it', async () => {
		state.identity.set({ ...LDAP_ALICE, metadata: {} });
		state.mappings.set(list({ entries: MAPPINGS.filter(m => m.name === 'ldap-admins'), catalogue: { ops_admin: { cluster: ['manage_security'] } } }));
		const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
		render(RoleMappings);
		const row = await rowFor('ldap-admins');

		await fireEvent.click(row.getByTitle('Delete role mapping'));
		expect(confirm.mock.calls[0][0]).toMatch(/cannot tell/);
		expect(state.dispatch).toHaveBeenCalledWith('security/roleMappings/delete', { name: 'ldap-admins', acknowledged: true });
	});
});
