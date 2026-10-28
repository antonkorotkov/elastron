// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import { tick } from 'svelte';
import { toRoleMappingEntries } from '$lib/store/elasticsearch/securityList.js';

const state = vi.hoisted(() => ({ mappings: null, identity: null, dispatch: null, close: null }));
const api = vi.hoisted(() => ({ query: null, byName: null }));

vi.mock('@storeon/svelte', () => {
	const { writable } = require('svelte/store');
	state.mappings = writable({ entries: [], catalogue: {} });
	state.identity = writable({ username: 'elastic', roles: ['superuser'] });
	return {
		useStoreon: () => ({
			dispatch: (...a) => state.dispatch(...a),
			app: writable({ theme: 'light' }),
			connection: writable({}),
			securityRoleMappings: state.mappings,
			securityIdentity: state.identity,
		}),
	};
});

vi.mock('svelte', async importOriginal => {
	const actual = await importOriginal();
	return { ...actual, getContext: () => ({ close: (...a) => state.close(...a) }) };
});

vi.mock('$lib/api/elasticsearch', () => ({
	default: vi.fn(function () {
		return {
			querySecurityRoles: (...a) => api.query(...a),
			getSecurityRolesByName: (...a) => api.byName(...a),
		};
	}),
}));

// What the JSON view holds is read through a stub, as the role editor tests do.
const jsonHeld = vi.hoisted(() => {
	globalThis.__JSON_HELD__ = { value: null };
	return globalThis.__JSON_HELD__;
});
vi.mock('$lib/components/JsonEditor.svelte', async () => {
	const { default: Stub } = await import('../__JsonEditorStub.svelte');
	return { default: Stub };
});

Element.prototype.scrollIntoView ??= () => {};

import RoleMappingEditor from './RoleMappingEditor.svelte';

const OPS = 'cn=ops,ou=groups,dc=example,dc=com';
const ADMINS = 'cn=admins,ou=groups,dc=example,dc=com';
const ROLES = [{ name: 'ops_admin', cluster: ['manage_security'] }, { name: 'viewer', cluster: [] }];

const [NESTED, TEMPLATED, ADMIN_MAPPING, READ_ONLY] = toRoleMappingEntries({
	nested: {
		enabled: true,
		roles: ['viewer'],
		rules: { any: [{ all: [{ field: { username: 'a' } }, { field: { 'metadata.level': 5 } }] }, { field: { dn: '/cn=adm.*/' } }] },
		metadata: {},
	},
	tpl: {
		enabled: true,
		role_templates: [{ template: '{"source":"{{#tojson}}groups{{/tojson}}"}', format: 'json' }],
		rules: { field: { 'realm.name': 'saml1' } },
		metadata: {},
	},
	'ldap-admins': { enabled: true, roles: ['ops_admin'], rules: { field: { groups: ADMINS } }, metadata: {} },
	'ops-read-only-operator-mapping': {
		enabled: true,
		roles: ['viewer'],
		rules: { field: { groups: OPS } },
		metadata: { _read_only: true },
	},
});

const settle = () => new Promise(r => setTimeout(r, 350));
const field = label => screen.getByText(label, { selector: 'label' }).closest('.field');

const pick = async (label, option) => {
	const f = field(label);
	f.querySelector('.svelte-select').dispatchEvent(new Event('pointerup', { bubbles: true }));
	await tick();
	await fireEvent.input(f.querySelector('.svelte-select input'), { target: { value: option } });
	await settle();
	await tick();
	await fireEvent.click([...f.querySelectorAll('.svelte-select-list .list-item')].find(el => el.textContent.trim() === option));
	await new Promise(r => setTimeout(r, 0));
	await tick();
};

const sent = () => state.dispatch.mock.calls.find(([event]) => event === 'security/roleMappings/put')?.[1];

const LDAP_ALICE = {
	username: 'alice',
	roles: ['ops_admin'],
	authenticationType: 'realm',
	realm: { name: 'ldap1', type: 'ldap' },
	metadata: { ldap_dn: 'cn=alice,dc=example,dc=com', ldap_groups: [ADMINS] },
};

beforeEach(() => {
	api.query = vi.fn(async ({ search = '' } = {}) => ({ mode: 'paged', roles: ROLES.filter(r => r.name.includes(search)) }));
	api.byName = vi.fn(async names => Object.fromEntries(ROLES.filter(r => names.includes(r.name)).map(r => [r.name, r])));
	state.dispatch = vi.fn();
	state.close = vi.fn();
	jsonHeld.value = null;
	state.identity.set({ username: 'elastic', roles: ['superuser'], authenticationType: 'realm', realm: { name: 'reserved', type: 'reserved' } });
	state.mappings.set({ entries: [NESTED, TEMPLATED, ADMIN_MAPPING, READ_ONLY], catalogue: {} });
});

describe('creating a mapping', () => {
	it('sends a directory group mapping', async () => {
		render(RoleMappingEditor, { props: { name: null } });

		await fireEvent.input(screen.getByLabelText('Mapping Name'), { target: { value: 'ldap-ops' } });
		await pick('Roles', 'ops_admin');
		await fireEvent.input(screen.getByLabelText('Values'), { target: { value: OPS } });
		await fireEvent.click(screen.getByText('Create'));

		expect(sent()).toEqual({
			name: 'ldap-ops',
			body: { enabled: true, roles: ['ops_admin'], rules: { field: { groups: OPS } } },
			isNew: true,
			acknowledged: false,
		});
		expect(state.close).toHaveBeenCalled();
	});

	it('requires all conditions to hold, with an exception', async () => {
		render(RoleMappingEditor, { props: { name: null } });

		await fireEvent.input(screen.getByLabelText('Mapping Name'), { target: { value: 'm' } });
		await pick('Roles', 'viewer');
		await fireEvent.change(screen.getByLabelText('Field'), { target: { value: 'realm.name' } });
		await fireEvent.input(screen.getByLabelText('Values'), { target: { value: 'ldap1' } });
		await fireEvent.click(screen.getByText('Add Condition'));
		await fireEvent.input(screen.getAllByLabelText('Values')[1], { target: { value: `${OPS}\ncn=sre,ou=groups,dc=example,dc=com` } });
		await fireEvent.click(screen.getByText('Add Exception'));
		await fireEvent.input(screen.getAllByLabelText('Values')[2], { target: { value: 'cn=contractors,dc=example,dc=com' } });
		await fireEvent.click(screen.getByText('Create'));

		expect(sent().body.rules).toEqual({
			all: [
				{ field: { 'realm.name': 'ldap1' } },
				{ field: { groups: [OPS, 'cn=sre,ou=groups,dc=example,dc=com'] } },
				{ except: { field: { groups: 'cn=contractors,dc=example,dc=com' } } },
			],
		});
	});

	it('does not offer an exception when any condition may hold', async () => {
		render(RoleMappingEditor, { props: { name: null } });

		await fireEvent.click(screen.getByLabelText('Any condition may hold'));
		expect(screen.queryByText('Add Exception')).toBeNull();
		expect(screen.getByText(/exception needs a group whose conditions must all hold/)).toBeTruthy();
	});

	it('will not take the name of a mapping that exists', async () => {
		render(RoleMappingEditor, { props: { name: null } });

		await fireEvent.input(screen.getByLabelText('Mapping Name'), { target: { value: 'ldap-admins' } });
		expect(screen.getByText(/already exists/)).toBeTruthy();
		expect(screen.getByText('Create').disabled).toBe(true);
	});

	it('starts the rules afresh when the JSON view held none', async () => {
		render(RoleMappingEditor, { props: { name: null } });

		await fireEvent.click(screen.getByText('JSON'));
		jsonHeld.value = { enabled: true, roles: ['viewer'] };
		await fireEvent.click(screen.getByText('Form'));

		expect(screen.queryByText(/nest groups more deeply/)).toBeNull();
		expect(screen.getByText('Add Condition')).toBeTruthy();
		expect(screen.getByText(/at least one value/)).toBeTruthy();
	});

	it('will not save without a condition value or a role', async () => {
		render(RoleMappingEditor, { props: { name: null } });
		await fireEvent.input(screen.getByLabelText('Mapping Name'), { target: { value: 'm' } });

		expect(screen.getByText('Create').disabled).toBe(true);
		expect(screen.getByText(/at least one value/)).toBeTruthy();
		expect(screen.getByText(/at least one role/)).toBeTruthy();

		await fireEvent.click(screen.getByText('Remove'));
		expect(screen.getByText(/at least one condition/)).toBeTruthy();
	});
});

describe('editing a mapping', () => {
	it('sends nested rules back unchanged after a role edit', async () => {
		render(RoleMappingEditor, { props: { name: 'nested', existing: NESTED } });

		expect(screen.getByText(/nest groups more deeply/)).toBeTruthy();
		await pick('Roles', 'ops_admin');
		await fireEvent.click(screen.getByText('Save'));

		expect(sent().body).toEqual({ enabled: true, roles: ['viewer', 'ops_admin'], rules: NESTED.rules });
	});

	it('shows templates instead of the role picker', () => {
		render(RoleMappingEditor, { props: { name: 'tpl', existing: TEMPLATED } });

		expect(field('Roles').querySelector('.svelte-select')).toBeNull();
		expect(screen.getByText(/grants roles through templates/)).toBeTruthy();
		expect(screen.getByText(/tojson/)).toBeTruthy();
	});

	it('sends the JSON view as given', async () => {
		render(RoleMappingEditor, { props: { name: 'tpl', existing: TEMPLATED } });

		await fireEvent.click(screen.getByText('JSON'));
		jsonHeld.value = {
			enabled: true,
			role_templates: [{ template: { source: '{{username}}' }, format: 'string' }],
			rules: { any: [{ all: [{ field: { username: 'x' } }] }] },
		};
		await fireEvent.click(screen.getByText('Save'));

		expect(sent().body).toEqual(jsonHeld.value);
	});

	it('offers nothing to change on a read-only mapping', () => {
		render(RoleMappingEditor, { props: { name: READ_ONLY.name, existing: READ_ONLY } });

		expect(screen.getByText(/operator settings/)).toBeTruthy();
		expect(screen.queryByText('Save')).toBeNull();
		expect(screen.getByLabelText('Values').disabled).toBe(true);
	});
});

describe('the lockout guard in the editor', () => {
	beforeEach(() => {
		state.identity.set(LDAP_ALICE);
		state.mappings.set({ entries: [ADMIN_MAPPING], catalogue: { ops_admin: ROLES[0] } });
	});

	it('refuses to save rules that would stop the mapping applying to you', async () => {
		render(RoleMappingEditor, { props: { name: 'ldap-admins', existing: ADMIN_MAPPING } });

		await fireEvent.input(screen.getByLabelText('Values'), { target: { value: OPS } });

		expect(screen.getByTestId('mapping-lockout').textContent).toMatch(/locked out/);
		expect(screen.getByText('Save').disabled).toBe(true);
	});

	it('refuses the same change made in the JSON view', async () => {
		render(RoleMappingEditor, { props: { name: 'ldap-admins', existing: ADMIN_MAPPING } });

		await fireEvent.click(screen.getByText('JSON'));
		jsonHeld.value = { enabled: false, roles: ['ops_admin'], rules: ADMIN_MAPPING.rules };
		await fireEvent.click(screen.getByText('Save'));

		expect(sent()).toBeUndefined();
		expect(screen.getByTestId('mapping-lockout')).toBeTruthy();
	});

	it('needs an acknowledgement when it cannot tell', async () => {
		state.identity.set({ ...LDAP_ALICE, metadata: {} });
		render(RoleMappingEditor, { props: { name: 'ldap-admins', existing: ADMIN_MAPPING } });

		await fireEvent.click(screen.getByLabelText('Enabled'));
		expect(screen.getByText('Save').disabled).toBe(true);

		await fireEvent.click(screen.getByLabelText('I understand this may lock me out'));
		await fireEvent.click(screen.getByText('Save'));

		expect(sent()).toMatchObject({ name: 'ldap-admins', body: { enabled: false }, acknowledged: true });
	});

	it('asks again for a warning that cleared and came back', async () => {
		// A regular expression the guard cannot judge, until it names you outright.
		const [byPattern] = toRoleMappingEntries({
			'by-pattern': { enabled: true, roles: ['ops_admin'], rules: { field: { username: '/al.*/' } }, metadata: {} },
		});
		state.mappings.set({ entries: [byPattern], catalogue: { ops_admin: ROLES[0] } });
		render(RoleMappingEditor, { props: { name: 'by-pattern', existing: byPattern } });

		await fireEvent.click(screen.getByLabelText('I understand this may lock me out'));
		await fireEvent.input(screen.getByLabelText('Values'), { target: { value: 'alice' } });
		expect(screen.queryByTestId('mapping-lockout')).toBeNull();

		await fireEvent.input(screen.getByLabelText('Values'), { target: { value: '/al.*/' } });
		expect(screen.getByLabelText('I understand this may lock me out').checked).toBe(false);
		expect(screen.getByText('Save').disabled).toBe(true);
	});
});
