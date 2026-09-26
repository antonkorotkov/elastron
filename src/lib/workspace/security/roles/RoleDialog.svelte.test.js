// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import { tick } from 'svelte';

const state = vi.hoisted(() => ({ roles: null, privileges: null, dispatch: null, close: null }));

vi.mock('@storeon/svelte', () => {
	const { writable } = require('svelte/store');
	state.roles = writable({ entries: [] });
	state.privileges = writable({ cluster: [], index: [], remote_cluster: [], loaded: true });
	return {
		useStoreon: () => ({
			dispatch: (...a) => state.dispatch(...a),
			app: writable({ theme: 'light' }),
			securityRoles: state.roles,
			securityPrivileges: state.privileges,
		}),
	};
});

vi.mock('svelte', async importOriginal => {
	const actual = await importOriginal();
	return { ...actual, getContext: () => ({ close: (...a) => state.close(...a) }) };
});

// The JSON view is exercised through a stub: jsoneditor needs a real layout
// engine, and what matters here is that whatever it holds is what gets sent.
const jsonHeld = vi.hoisted(() => {
	globalThis.__JSON_HELD__ = { value: null };
	return globalThis.__JSON_HELD__;
});
vi.mock('$lib/components/JsonEditor.svelte', async () => {
	const { default: Stub } = await import('../__JsonEditorStub.svelte');
	return { default: Stub };
});

// svelte-select scrolls the hovered option into view; jsdom has no layout and
// so no scrollIntoView. Selection behaviour is what these tests exercise.
Element.prototype.scrollIntoView ??= () => {};

import RoleDialog from './RoleDialog.svelte';

// A role shaped like one the Enterprise cluster returns.
const REAL_ROLE = {
	name: 'acc_role_522cd3ae',
	reserved: false,
	hasDocumentQuery: true,
	cluster: ['monitor'],
	indices: [
		{
			names: ['assets', 'assets_v*'],
			privileges: ['read', 'view_index_metadata'],
			query: '{"bool":{"should":[{"terms":{"holder.id":["522cd3ae"]}}]}}',
			allow_restricted_indices: false,
		},
	],
	applications: [{ application: 'kibana-.kibana', privileges: ['all'], resources: ['*'] }],
	run_as: [],
	metadata: { team: 'assets' },
	transient_metadata: { enabled: true },
};

beforeEach(() => {
	state.dispatch = vi.fn();
	state.close = vi.fn();
	jsonHeld.value = null;
	state.roles.set({ entries: [REAL_ROLE, { name: 'superuser', reserved: true, cluster: ['all'], indices: [] }] });
	state.privileges.set({
		cluster: ['monitor', 'manage_security', 'monitor_esql'],
		index: ['read', 'write', 'view_index_metadata'],
		remote_cluster: [],
		loaded: true,
	});
});

const savedBody = () => state.dispatch.mock.calls.find(c => c[0] === 'security/roles/put')[1].body;

// Drives the searchable multi-select the way a user does. The widget opens its
// list on pointerup over the container, so that is the event to send; jsdom has
// no PointerEvent, hence the plain bubbling Event.
const openList = async fieldLabel => {
	const field = screen.getByText(fieldLabel).closest('.field');
	field.querySelector('.svelte-select').dispatchEvent(new Event('pointerup', { bubbles: true }));
	await tick();
	return field;
};

const optionsIn = field =>
	[...field.querySelectorAll('.svelte-select-list .item')].map(el => el.textContent.trim());

const filterList = async (fieldLabel, text) => {
	const field = await openList(fieldLabel);
	await fireEvent.input(field.querySelector('.svelte-select input'), { target: { value: text } });
	await tick();
	return field;
};

const pickOption = async (fieldLabel, option) => {
	const field = await filterList(fieldLabel, option);
	const item = [...field.querySelectorAll('.svelte-select-list .item')].find(
		el => el.textContent.trim() === option
	);
	await fireEvent.click(item);
	// svelte-select reports the change from a setTimeout, not synchronously.
	await new Promise(resolve => setTimeout(resolve, 0));
	await tick();
};

const listOptions = async fieldLabel => optionsIn(await openList(fieldLabel));

describe('RoleDialog', () => {
	it('preserves unmodelled fields through an edit made in the form', async () => {
		render(RoleDialog, { props: { name: REAL_ROLE.name } });

		await fireEvent.input(screen.getByLabelText('Run As'), { target: { value: 'someone' } });
		await fireEvent.click(screen.getByText('Save'));

		const body = savedBody();
		expect(body.applications).toEqual(REAL_ROLE.applications);
		expect(body.indices[0].query).toBe(REAL_ROLE.indices[0].query);
		expect(body.run_as).toEqual(['someone']);
	});

	it('preserves unmodelled fields through a privilege picked from the dropdown', async () => {
		render(RoleDialog, { props: { name: REAL_ROLE.name } });

		await pickOption('Cluster Privileges', 'manage_security');
		await fireEvent.click(screen.getByText('Save'));

		const body = savedBody();
		expect(body.cluster).toEqual(['monitor', 'manage_security']);
		expect(body.applications).toEqual(REAL_ROLE.applications);
		expect(body.indices[0].query).toBe(REAL_ROLE.indices[0].query);
	});

	it('strips fields the cluster refuses on write', async () => {
		render(RoleDialog, { props: { name: REAL_ROLE.name } });
		await fireEvent.click(screen.getByText('Save'));

		const body = savedBody();
		expect(body).not.toHaveProperty('transient_metadata');
		expect(body).not.toHaveProperty('name');
		expect(body).not.toHaveProperty('hasDocumentQuery');
	});

	it('tells the user which fields the form is not showing', () => {
		render(RoleDialog, { props: { name: REAL_ROLE.name } });
		expect(screen.getByText(/also sets applications/)).toBeTruthy();
	});

	it('edits a block query in the block, not by sending the user to the JSON view', () => {
		render(RoleDialog, { props: { name: REAL_ROLE.name } });

		// The block hosts its own editor; the old note pointing at the whole-role
		// JSON is gone.
		expect(screen.getByText('Document query')).toBeTruthy();
		expect(screen.getAllByTestId('json-editor-stub').length).toBeGreaterThan(0);
		expect(screen.queryByText(/Edit these in the JSON view/)).toBeNull();
	});

	it('offers the privileges the cluster reported, including ones newer than the app', async () => {
		render(RoleDialog, { props: { name: REAL_ROLE.name } });

		expect(await listOptions('Cluster Privileges')).toContain('monitor_esql');
	});

	it('lets a long privilege list be searched rather than scrolled', async () => {
		render(RoleDialog, { props: { name: REAL_ROLE.name } });

		const field = await filterList('Cluster Privileges', 'esql');
		expect(optionsIn(field)).toEqual(['monitor_esql']);
	});

	it('sends what the JSON view holds, including fields outside the form', async () => {
		render(RoleDialog, { props: { name: REAL_ROLE.name } });

		await fireEvent.click(screen.getByText('JSON'));
		jsonHeld.value = {
			cluster: ['monitor'],
			indices: [],
			global: { application: { manage: { applications: ['x'] } } },
			remote_indices: [{ clusters: ['a'], names: ['b'], privileges: ['read'] }],
		};
		await fireEvent.click(screen.getByText('Save'));

		expect(savedBody()).toEqual(jsonHeld.value);
	});

	it('shows a reserved role read-only', () => {
		render(RoleDialog, { props: { name: 'superuser' } });

		expect(document.querySelector('.ui.header').textContent).toMatch(/reserved/);
		expect(screen.queryByText('Save')).toBeNull();
		expect(screen.getByText('Close')).toBeTruthy();
	});

	it('creates a new role from an empty definition', async () => {
		render(RoleDialog, { props: { name: null } });

		await fireEvent.input(screen.getByLabelText('Role Name'), { target: { value: 'new_role' } });
		await pickOption('Cluster Privileges', 'monitor');
		await fireEvent.click(screen.getByText('Create'));

		const call = state.dispatch.mock.calls.find(c => c[0] === 'security/roles/put');
		expect(call[1]).toMatchObject({ name: 'new_role', isNew: true });
		expect(call[1].body.cluster).toEqual(['monitor']);
	});
});
