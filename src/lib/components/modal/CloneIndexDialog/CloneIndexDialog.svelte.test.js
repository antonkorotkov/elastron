// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import CloneIndexDialog from './CloneIndexDialog.svelte';
import { writable } from 'svelte/store';

vi.mock('@storeon/svelte', () => ({
	useStoreon: () => ({
		app: writable({ theme: 'light' }),
		connection: writable({}),
		indices: writable({ data: [['idx-1']], columns: ['index'] }),
		index: writable({ selected: 'idx-1' }),
		dispatch: vi.fn()
	})
}));

vi.mock('svelte', async (importOriginal) => ({
	...(await importOriginal()),
	getContext: () => ({ close: vi.fn() })
}));

describe('CloneIndexDialog', () => {
	it('renders clone index form', () => {
		render(CloneIndexDialog);
		expect(screen.getByText('Clone The Index')).toBeTruthy();
		expect(screen.getByLabelText('New Index Name')).toBeTruthy();
	});
});
