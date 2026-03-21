// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import EditControls from './EditControls.svelte';
import { writable } from 'svelte/store';

vi.mock('@storeon/svelte', () => ({
	useStoreon: () => ({
		app: writable({ theme: 'light' }),
		search: writable({ loading: false, editDoc: { _type: 'doc', _id: '1' } }),
		indices: writable({ data: [['idx']], columns: ['index'] }),
		connection: writable({}),
		dispatch: vi.fn()
	})
}));

vi.mock('svelte', async (importOriginal) => ({
	...(await importOriginal()),
	getContext: () => ({ open: vi.fn() })
}));

describe('EditControls', () => {
	it('renders correctly', () => {
		const { container } = render(EditControls);
		expect(container).toBeTruthy();
	});
});
