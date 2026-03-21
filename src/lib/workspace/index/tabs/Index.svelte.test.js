// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import IndexTab from './Index.svelte';
import { writable } from 'svelte/store';

vi.mock('@storeon/svelte', () => ({
	useStoreon: () => ({
		app: writable({ theme: 'light' }),
		connection: writable({}),
		indices: writable({}),
		index: writable({ selected: 'idx-1', info: { 'idx-1': { 'idx-1': { mappings: {} } } }, loading: false }),
		dispatch: vi.fn()
	})
}));

vi.mock('svelte', async (importOriginal) => ({
	...(await importOriginal()),
	getContext: () => ({ open: vi.fn(), close: vi.fn() })
}));

describe('Index Tab', () => {
	it('renders action buttons', () => {
		render(IndexTab);
		expect(screen.getByRole('button', { name: 'Open' })).toBeTruthy();
		expect(screen.getByRole('button', { name: 'Close' })).toBeTruthy();
		expect(screen.getByRole('button', { name: 'Clone' })).toBeTruthy();
		expect(screen.getByRole('button', { name: 'Wipe' })).toBeTruthy();
		expect(screen.getByRole('button', { name: 'Delete' })).toBeTruthy();
	});
});
