// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import Indices from './Indices.svelte';
import { writable } from 'svelte/store';

const mockDispatch = vi.fn();

vi.mock('@storeon/svelte', () => ({
	useStoreon: () => ({
		app: writable({ theme: 'light' }),
		indices: writable({ data: [['idx', 'green', 'open']], columns: ['index', 'health', 'status'], sorting: [], search: '', loading: false }),
		dispatch: mockDispatch
	})
}));

vi.mock('svelte', async (importOriginal) => ({
	...(await importOriginal()),
	getContext: () => ({ open: vi.fn() })
}));

describe('Indices Dashboard Component', () => {
	it('renders table and controls', () => {
		render(Indices);
		expect(screen.getByRole('button', { name: 'Refresh' })).toBeTruthy();
		expect(screen.getByRole('button', { name: 'Create' })).toBeTruthy();
		expect(screen.getByPlaceholderText('Search...')).toBeTruthy();
		expect(screen.getByText('idx')).toBeTruthy();
	});
});
