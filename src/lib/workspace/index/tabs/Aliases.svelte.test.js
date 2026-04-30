// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import AliasesTab from './Aliases.svelte';
import { writable } from 'svelte/store';

vi.mock('@storeon/svelte', () => ({
	useStoreon: () => ({
		app: writable({ theme: 'light' }),
		index: writable({ selected: 'idx-1', info: { 'idx-1': { 'idx-1': { aliases: { 'alias-1': {} } } } }, loading: false }),
		dispatch: vi.fn()
	})
}));

vi.mock('svelte', async (importOriginal) => ({
	...(await importOriginal()),
	getContext: () => ({ open: vi.fn(), close: vi.fn() })
}));

describe('Aliases Tab', () => {
	it('renders aliases table', () => {
		render(AliasesTab);
		expect(screen.getByText('alias-1')).toBeTruthy();
		expect(screen.getByRole('button', { name: 'Create' })).toBeTruthy();
	});
});
