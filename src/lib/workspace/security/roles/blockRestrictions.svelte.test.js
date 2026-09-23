// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import { tick } from 'svelte';

const state = vi.hoisted(() => ({ roles: null, privileges: null, dispatch: null, close: null }));
const api = vi.hoisted(() => ({ render: null, preview: null }));

vi.mock('@storeon/svelte', () => {
	const { writable } = require('svelte/store');
	state.roles = writable({ entries: [] });
	state.privileges = writable({ cluster: ['monitor'], index: ['read'], remote_cluster: [], loaded: true });
	return {
		useStoreon: () => ({
			dispatch: (...a) => state.dispatch(...a),
			app: writable({ theme: 'light' }),
			connection: writable({ host: 'http://es', port: '9200' }),
			securityRoles: state.roles,
			securityPrivileges: state.privileges,
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
			renderSecurityQueryTemplate: (...a) => api.render(...a),
			previewSecurityQuery: (...a) => api.preview(...a),
		};
	}),
}));

const jsonHeld = vi.hoisted(() => {
	globalThis.__JSON_HELD__ = { value: null };
	return globalThis.__JSON_HELD__;
});

vi.mock('$lib/components/JsonEditor.svelte', async () => ({
	default: (await import('../__JsonEditorStub.svelte')).default,
}));

import RoleDialog from './RoleDialog.svelte';

// Two blocks restricted differently, which is the case the whole-role JSON
// made awkward: finding the right entry among several.
const TWO_BLOCKS = {
	name: 'tenant_reader',
	reserved: false,
	cluster: [],
	indices: [
		{ names: ['assets'], privileges: ['read'], query: '{"term":{"holder":"a"}}' },
		{ names: ['logs-*'], privileges: ['read'], query: '{"term":{"tenant":"b"}}' },
	],
	run_as: [],
};

const TEMPLATED = {
	name: 'own_docs',
	reserved: false,
	cluster: [],
	indices: [
		{
			names: ['docs'],
			privileges: ['read'],
			query: '{"template":{"source":"{\\"term\\":{\\"owner\\":\\"{{_user.username}}\\"}}"}}',
		},
	],
	run_as: [],
};

const savedBody = () => state.dispatch.mock.calls.find(c => c[0] === 'security/roles/put')[1].body;
const blocks = () => [...document.querySelectorAll('#role-indices .block')];
const save = async () => {
	await fireEvent.click(screen.getByText('Save'));
	await new Promise(r => setTimeout(r, 0));
	await tick();
};

beforeEach(() => {
	state.dispatch = vi.fn();
	state.close = vi.fn();
	jsonHeld.value = null;
	api.render = vi.fn().mockResolvedValue({ query: { term: { owner: 'preview_user' } } });
	api.preview = vi.fn().mockResolvedValue({ matching: 2, total: 5 });
	state.roles.set({ entries: [TWO_BLOCKS, TEMPLATED] });
});

describe('editing a block query in the block', () => {
	it('gives every block its own editor', () => {
		render(RoleDialog, { props: { name: TWO_BLOCKS.name } });

		expect(blocks()).toHaveLength(2);
		expect(screen.getAllByText('Document query')).toHaveLength(2);
	});

	it('leaves an untouched role exactly as the cluster reported it', async () => {
		render(RoleDialog, { props: { name: TWO_BLOCKS.name } });
		await save();

		expect(savedBody().indices).toEqual(TWO_BLOCKS.indices);
	});

	it('changes only the block that was edited', async () => {
		render(RoleDialog, { props: { name: TWO_BLOCKS.name } });

		// The stub stands in for every editor, so the second block is edited by
		// clearing the first one's query and leaving the rest alone.
		const second = blocks()[1];
		await fireEvent.click([...second.querySelectorAll('button')].find(b => b.textContent.trim() === 'None'));
		await save();

		const saved = savedBody().indices;
		expect(saved[0].query).toBe(TWO_BLOCKS.indices[0].query);
		expect(saved[1]).not.toHaveProperty('query');
	});

	it('omits the query when it is cleared rather than sending it empty', async () => {
		render(RoleDialog, { props: { name: TWO_BLOCKS.name } });

		for (const block of blocks()) {
			await fireEvent.click([...block.querySelectorAll('button')].find(b => b.textContent.trim() === 'None'));
		}
		await save();

		for (const block of savedBody().indices) {
			expect(block).not.toHaveProperty('query');
			expect(block).not.toHaveProperty('field_security');
		}
	});

	it('shows a template own source, and sends it back as a template', async () => {
		render(RoleDialog, { props: { name: TEMPLATED.name } });

		expect(screen.getByText(/interpolates the requesting user/)).toBeTruthy();
		await save();

		expect(savedBody().indices[0].query).toBe(TEMPLATED.indices[0].query);
	});
});

describe('checking a restriction before it can silently deny access', () => {
	it('refuses to save a template the cluster would accept but cannot render', async () => {
		api.render = vi.fn().mockRejectedValue(new Error('[1:25] Unexpected end of file'));
		render(RoleDialog, { props: { name: TEMPLATED.name } });

		jsonHeld.value = { term: { owner: '{{_user.username' } };
		await save();

		expect(state.dispatch).not.toHaveBeenCalledWith('security/roles/put', expect.anything());
		expect(screen.getByText(/does not render/)).toBeTruthy();
		expect(screen.getByText(/Index block 1/)).toBeTruthy();
	});

	it('names the block a bad query came from, since the cluster only gives a position', async () => {
		render(RoleDialog, { props: { name: TWO_BLOCKS.name } });

		jsonHeld.value = { __throw: 'Unexpected token }' };
		await save();

		expect(state.dispatch).not.toHaveBeenCalledWith('security/roles/put', expect.anything());
		expect(screen.getByText(/Index block 1/)).toBeTruthy();
	});

	it('reports what a query matches when the account may read the data', async () => {
		render(RoleDialog, { props: { name: TWO_BLOCKS.name } });

		await fireEvent.click(screen.getAllByText(/What does this match\?/)[0]);
		await new Promise(r => setTimeout(r, 0));
		await tick();

		expect(api.preview).toHaveBeenCalledWith(['assets'], { term: { holder: 'a' } });
		expect(screen.getByText(/of 5 documents/)).toBeTruthy();
	});

	it('warns when a query matches nothing, which is valid and usually wrong', async () => {
		api.preview = vi.fn().mockResolvedValue({ matching: 0, total: 5 });
		render(RoleDialog, { props: { name: TWO_BLOCKS.name } });

		await fireEvent.click(screen.getAllByText(/What does this match\?/)[0]);
		await new Promise(r => setTimeout(r, 0));
		await tick();

		expect(screen.getByText(/would see no documents/)).toBeTruthy();
	});

	it('omits the preview without complaint when the account cannot read the data', async () => {
		api.preview = vi.fn().mockRejectedValue(Object.assign(new Error('nope'), { cause: 'privilege' }));
		render(RoleDialog, { props: { name: TWO_BLOCKS.name } });

		await fireEvent.click(screen.getAllByText(/What does this match\?/)[0]);
		await new Promise(r => setTimeout(r, 0));
		await tick();

		expect(screen.getByText(/cannot read those indices/)).toBeTruthy();
		expect(screen.getByText(/can still be saved/)).toBeTruthy();
		expect(screen.getByText('Save').disabled).toBe(false);
	});
});

describe('field restrictions', () => {
	it('round-trips what the cluster stores', async () => {
		state.roles.set({
			entries: [
				{
					...TWO_BLOCKS,
					indices: [{ names: ['a'], privileges: ['read'], field_security: { grant: ['x'], except: ['x.secret'] } }],
				},
			],
		});
		render(RoleDialog, { props: { name: TWO_BLOCKS.name } });
		await save();

		expect(savedBody().indices[0].field_security).toEqual({ grant: ['x'], except: ['x.secret'] });
	});

	it('refuses except without grant, which the cluster rejects', async () => {
		render(RoleDialog, { props: { name: TWO_BLOCKS.name } });

		await fireEvent.input(screen.getAllByLabelText('Fields excepted')[0], { target: { value: 'secret' } });
		await tick();

		// Flagged inline as soon as it is typed.
		expect(screen.getAllByText(/need granted fields/).length).toBeGreaterThan(0);

		await save();

		expect(state.dispatch).not.toHaveBeenCalledWith('security/roles/put', expect.anything());
		// And named by block when the save is attempted, since the cluster
		// identifies the entry only by position.
		expect(screen.getByText(/Index block 1: .*need granted fields/)).toBeTruthy();
	});
});
