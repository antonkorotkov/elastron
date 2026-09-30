// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/svelte';

const state = vi.hoisted(() => ({ keys: null, dispatch: null, open: null }));

vi.mock('@storeon/svelte', () => {
	const { writable } = require('svelte/store');
	state.keys = writable({ entries: [], loaded: true, loading: false, cause: null, message: '', reason: '', search: '', sorting: [], scope: 'all', showInvalidated: false });
	return {
		useStoreon: () => ({
			dispatch: (...a) => state.dispatch(...a),
			app: writable({ theme: 'light' }),
			securityApiKeys: state.keys,
		}),
	};
});

vi.mock('svelte', async importOriginal => {
	const actual = await importOriginal();
	return { ...actual, getContext: () => ({ open: (...a) => state.open(...a) }) };
});

import ApiKeys from './ApiKeys.svelte';

const KEYS = [
	{ id: 'k1', name: 'ingest', username: 'elastic', creation: 1700000000000, expiration: null, invalidated: false },
	{ id: 'k2', name: 'retired', username: 'alice', creation: 1700000001000, expiration: null, invalidated: true },
];

const setKeys = (entries, extra = {}) =>
	state.keys.set({ entries, loaded: true, loading: false, cause: null, message: '', reason: '', search: '', sorting: [], scope: 'all', showInvalidated: false, ...extra });

const rowFor = async name => within((await screen.findByText(name)).closest('tr'));

beforeEach(() => {
	window.__IS_TEST__ = true;
	state.dispatch = vi.fn();
	state.open = vi.fn();
	setKeys(KEYS);
});

describe('API keys surface', () => {
	it('hides invalidated keys by default, since nothing can act on them', async () => {
		render(ApiKeys);

		expect(await screen.findByText('ingest')).toBeTruthy();
		expect(screen.queryByText('retired')).toBeNull();
		expect(screen.getByText('1 item')).toBeTruthy();
	});

	it('says how many are hidden, and why they cannot be removed', () => {
		render(ApiKeys);

		const note = screen.getByText(/1 invalidated hidden/);
		expect(note.getAttribute('title')).toMatch(/no delete for API keys/);
		expect(note.getAttribute('title')).toMatch(/retention period/);
	});

	it('does not mention hidden keys when there are none', () => {
		setKeys([KEYS[0]]);
		render(ApiKeys);

		expect(screen.queryByText(/invalidated hidden/)).toBeNull();
	});

	it('shows them once asked, with distinct status labels', async () => {
		setKeys(KEYS, { showInvalidated: true });
		render(ApiKeys);

		expect(await screen.findByText('retired')).toBeTruthy();
		expect(screen.getByText('active').classList.contains('green')).toBe(true);
		expect(screen.getByText('invalidated').classList.contains('red')).toBe(true);
		expect(screen.getByText('2 items')).toBeTruthy();
	});

	it('explains on the invalidated label that the cluster clears it', () => {
		setKeys(KEYS, { showInvalidated: true });
		render(ApiKeys);

		expect(screen.getByText('invalidated').getAttribute('title')).toMatch(/retention period/);
	});

	it('asks the store to reveal them when the toggle is used', async () => {
		render(ApiKeys);

		await fireEvent.click(screen.getByLabelText('Show invalidated'));

		expect(state.dispatch).toHaveBeenCalledWith('security/api-keys/update', { showInvalidated: true });
	});

	it('never shows a key secret in the list', () => {
		render(ApiKeys);
		expect(document.body.textContent).not.toMatch(/encoded|api_key/i);
	});

	it('says when it is only showing the account own keys', () => {
		setKeys(KEYS, { scope: 'own' });
		render(ApiKeys);

		const note = screen.getByText(/own keys only/);
		expect(note.getAttribute('title')).toMatch(/manage_api_key or manage_security/);
	});

	it('does not say that when showing every key', () => {
		render(ApiKeys);
		expect(screen.queryByText(/own keys only/)).toBeNull();
	});

	it('offers invalidation on a live key only', async () => {
		setKeys(KEYS, { showInvalidated: true });
		render(ApiKeys);

		expect((await rowFor('ingest')).getByTitle('Invalidate key')).toBeTruthy();
		expect((await rowFor('retired')).queryByTitle('Invalidate key')).toBeNull();
	});

	it('uses a revoke icon, not a trash can, since this is not a delete', async () => {
		render(ApiKeys);

		const action = (await rowFor('ingest')).getByTitle('Invalidate key');
		expect(action.querySelector('i.ban.icon')).toBeTruthy();
		expect(action.querySelector('i.trash')).toBeNull();
	});

	it('invalidates by id after confirmation', async () => {
		vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));
		render(ApiKeys);

		await fireEvent.click((await rowFor('ingest')).getByTitle('Invalidate key'));

		expect(state.dispatch).toHaveBeenCalledWith('security/api-keys/invalidate', { id: 'k1', name: 'ingest' });
	});

	it('leaves the key alone when the confirmation is dismissed', async () => {
		vi.stubGlobal('confirm', vi.fn().mockReturnValue(false));
		render(ApiKeys);

		await fireEvent.click((await rowFor('ingest')).getByTitle('Invalidate key'));

		expect(state.dispatch).not.toHaveBeenCalledWith('security/api-keys/invalidate', expect.anything());
	});
});
