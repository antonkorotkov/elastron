// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import EditAliasDialog from './EditAliasDialog.svelte';
import { writable } from 'svelte/store';

vi.mock('@storeon/svelte', () => ({
	useStoreon: () => ({
		app: writable({ theme: 'light' }),
		connection: writable({}),
		index: writable({ selected: 'idx-1' }),
		dispatch: vi.fn()
	})
}));

vi.mock('svelte', async (importOriginal) => ({
	...(await importOriginal()),
	getContext: () => ({ close: vi.fn() })
}));

describe('EditAliasDialog', () => {
	it('renders form', () => {
		render(EditAliasDialog, { alias: 'test-alias', aliases: { 'test-alias': { filter: {} } } });
		expect(screen.getByText('Update New Alias')).toBeTruthy();
		expect(screen.getByLabelText('Index Routing')).toBeTruthy();
	});
});
