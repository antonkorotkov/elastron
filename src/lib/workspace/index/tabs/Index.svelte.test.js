// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import IndexTab from './Index.svelte';

const stores = vi.hoisted(() => ({ connection: null }));

vi.mock('@storeon/svelte', () => {
	const { writable } = require('svelte/store');
	stores.connection = writable({});
	return {
		useStoreon: () => ({
			app: writable({ theme: 'light' }),
			connection: stores.connection,
			indices: writable({}),
			index: writable({ selected: 'idx-1', info: { 'idx-1': { 'idx-1': { mappings: {} } } }, loading: false }),
			dispatch: vi.fn()
		})
	};
});

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

	describe('destructive confirmations', () => {
		let confirmSpy;

		beforeEach(() => {
			// Decline, so the test stops at the prompt and never reaches the API
			confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
		});

		afterEach(() => {
			confirmSpy.mockRestore();
		});

		it('names the index and the cluster before deleting', async () => {
			stores.connection.set({ name: 'Production', host: 'https://prod' });
			render(IndexTab);

			await fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

			expect(confirmSpy.mock.calls[0][0]).toContain('"idx-1" on Production');
		});

		it('names the index and the cluster before wiping', async () => {
			stores.connection.set({ name: 'Production', host: 'https://prod' });
			render(IndexTab);

			await fireEvent.click(screen.getByRole('button', { name: 'Wipe' }));

			expect(confirmSpy.mock.calls[0][0]).toContain('"idx-1" on Production');
		});

		it('falls back to the address when the connection is unnamed', async () => {
			// Quick Connect sessions never carry a name
			stores.connection.set({ name: '', host: 'http://localhost', port: '9200' });
			render(IndexTab);

			await fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

			expect(confirmSpy.mock.calls[0][0]).toContain(
				'"idx-1" on http://localhost:9200'
			);
		});
	});
});
