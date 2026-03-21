// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import ConnectionDialog from './ConnectionDialog.svelte';
import { writable } from 'svelte/store';

vi.mock('@storeon/svelte', () => ({
	useStoreon: () => ({
		app: writable({ theme: 'light' }),
		connection: writable({ uri: '' }),
		history: writable({ connection: [] }),
		dispatch: vi.fn()
	})
}));

vi.mock('svelte', async (importOriginal) => ({
	...(await importOriginal()),
	getContext: () => ({ close: vi.fn() })
}));

describe('ConnectionDialog', () => {
	it('renders dialog form', () => {
		render(ConnectionDialog);
		expect(screen.getByText('Connection Settings')).toBeTruthy();
		expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy();
	});
});
