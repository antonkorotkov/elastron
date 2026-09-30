// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';

const state = vi.hoisted(() => ({ dispatch: null, close: null }));

vi.mock('@storeon/svelte', () => {
	const { writable } = require('svelte/store');
	return {
		useStoreon: () => ({ dispatch: (...a) => state.dispatch(...a), app: writable({ theme: 'light' }) }),
	};
});

vi.mock('svelte', async importOriginal => {
	const actual = await importOriginal();
	return { ...actual, getContext: () => ({ close: (...a) => state.close(...a) }) };
});

// jsoneditor needs a real layout engine. The stub exposes the same `editor`
// binding with a `get()` returning whatever a test put in the shared holder,
// which is what the dialog reads on save.
const jsonHeld = vi.hoisted(() => {
	globalThis.__JSON_HELD__ = { value: null };
	return globalThis.__JSON_HELD__;
});

vi.mock('$lib/components/JsonEditor.svelte', async () => ({
	default: (await import('../__JsonEditorStub.svelte')).default,
}));

import CreateApiKeyDialog from './CreateApiKeyDialog.svelte';

const SECRET = 'VnVhQ2ZHY0JDZGJrUW0tZTVhT3g6dWkybHAyYXhUTm1zeWFrdzl0dk5udw==';

const sentBody = () => state.dispatch.mock.calls.find(c => c[0] === 'security/api-keys/create')[1].body;
const fireCreated = key =>
	state.dispatch.mock.calls.find(c => c[0] === 'security/api-keys/create')[1].onCreated(key);

const enableRestrictions = async () => {
	await fireEvent.click(screen.getByLabelText('Restrict What This Key May Do'));
};

beforeEach(() => {
	state.dispatch = vi.fn();
	state.close = vi.fn();
	jsonHeld.value = null;
});

describe('CreateApiKeyDialog', () => {
	it('sends just a name when nothing else is set', async () => {
		render(CreateApiKeyDialog);

		await fireEvent.input(screen.getByLabelText('Name'), { target: { value: 'ingest' } });
		await fireEvent.click(screen.getByText('Create'));

		expect(sentBody()).toEqual({ name: 'ingest' });
	});

	it('edits role descriptors in the JSON editor, not a plain textarea', async () => {
		render(CreateApiKeyDialog);
		await enableRestrictions();

		expect(screen.getByTestId('json-editor-stub')).toBeTruthy();
		expect(document.querySelector('textarea')).toBeNull();
	});

	it('offers a usable descriptor to start from', async () => {
		render(CreateApiKeyDialog);
		await enableRestrictions();

		await fireEvent.input(screen.getByLabelText('Name'), { target: { value: 'ingest' } });
		await fireEvent.click(screen.getByText('Create'));

		expect(sentBody().role_descriptors).toEqual({ restricted: { cluster: ['monitor'] } });
	});

	it('includes an expiry and whatever the editor holds', async () => {
		render(CreateApiKeyDialog);

		await fireEvent.input(screen.getByLabelText('Name'), { target: { value: 'ingest' } });
		await fireEvent.input(screen.getByLabelText('Expires After'), { target: { value: '7d' } });
		await enableRestrictions();
		jsonHeld.value = { r: { cluster: ['monitor'], indices: [{ names: ['logs-*'], privileges: ['read'] }] } };
		await fireEvent.click(screen.getByText('Create'));

		expect(sentBody()).toEqual({
			name: 'ingest',
			expiration: '7d',
			role_descriptors: jsonHeld.value,
		});
	});

	it('sends no descriptors when restrictions are switched off', async () => {
		render(CreateApiKeyDialog);

		await fireEvent.input(screen.getByLabelText('Name'), { target: { value: 'ingest' } });
		await enableRestrictions();
		await enableRestrictions();
		await fireEvent.click(screen.getByText('Create'));

		expect(sentBody()).not.toHaveProperty('role_descriptors');
	});

	it('refuses to send descriptors the editor cannot parse', async () => {
		render(CreateApiKeyDialog);
		await fireEvent.input(screen.getByLabelText('Name'), { target: { value: 'ingest' } });
		await enableRestrictions();

		jsonHeld.value = { __throw: 'Unexpected token' };
		await fireEvent.click(screen.getByText('Create'));

		expect(state.dispatch).not.toHaveBeenCalled();
		expect(screen.getByText(/not valid JSON|Unexpected token/)).toBeTruthy();
	});

	it('refuses descriptors that are not an object', async () => {
		render(CreateApiKeyDialog);
		await fireEvent.input(screen.getByLabelText('Name'), { target: { value: 'ingest' } });
		await enableRestrictions();

		jsonHeld.value = ['not', 'an', 'object'];
		await fireEvent.click(screen.getByText('Create'));

		expect(state.dispatch).not.toHaveBeenCalled();
		expect(screen.getByText(/must be a JSON object/)).toBeTruthy();
	});

	it('shows the secret once, and says it cannot be retrieved again', async () => {
		render(CreateApiKeyDialog);

		await fireEvent.input(screen.getByLabelText('Name'), { target: { value: 'ingest' } });
		await fireEvent.click(screen.getByText('Create'));
		await fireCreated({ id: 'k1', name: 'ingest', encoded: SECRET, api_key: 'raw' });

		expect(await screen.findByTestId('api-key-secret')).toBeTruthy();
		expect(screen.getByTestId('api-key-secret').value).toBe(SECRET);
		expect(screen.getByText(/only time the key is shown/)).toBeTruthy();
		expect(screen.getByText(/invalidate this key/)).toBeTruthy();
	});

	it('offers a copy action for the secret', async () => {
		const writeText = vi.fn().mockResolvedValue(undefined);
		vi.stubGlobal('navigator', { clipboard: { writeText } });

		render(CreateApiKeyDialog);
		await fireEvent.input(screen.getByLabelText('Name'), { target: { value: 'ingest' } });
		await fireEvent.click(screen.getByText('Create'));
		await fireCreated({ id: 'k1', name: 'ingest', encoded: SECRET });

		await fireEvent.click(screen.getByText('Copy'));
		expect(writeText).toHaveBeenCalledWith(SECRET);
	});

	it('does not offer creation without a name', () => {
		render(CreateApiKeyDialog);
		expect(screen.getByText('Create').disabled).toBe(true);
	});
});
