// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import CreateIndexDialog from './CreateIndexDialog.svelte';
import { writable } from 'svelte/store';

vi.mock('@storeon/svelte', () => ({
	useStoreon: () => ({
		app: writable({ theme: 'light' }),
		connection: writable({}),
		indices: writable({ data: [['idx-1']], columns: ['index'] }),
		dispatch: vi.fn()
	})
}));

vi.mock('svelte', async (importOriginal) => ({
	...(await importOriginal()),
	getContext: () => ({ close: vi.fn() })
}));

describe('CreateIndexDialog', () => {
	it('renders form', () => {
		document.getElementById = vi.fn(() => ({ focus: vi.fn() }));
		render(CreateIndexDialog);
		expect(screen.getByText('Create New Index')).toBeTruthy();
		expect(screen.getByLabelText('Index Name')).toBeTruthy();
	});
});
