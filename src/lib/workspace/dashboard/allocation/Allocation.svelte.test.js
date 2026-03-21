// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import Allocation from './Allocation.svelte';
import { writable } from 'svelte/store';

const mockDispatch = vi.fn();

vi.mock('@storeon/svelte', () => ({
	useStoreon: () => ({
		app: writable({ theme: 'light' }),
		allocation: writable({ data: [['node-1', 5, '10gb']], columns: ['node', 'shards', 'disk'], sorting: [], search: '', loading: false }),
		dispatch: mockDispatch
	})
}));

describe('Allocation Dashboard Component', () => {
	it('renders table and controls', () => {
		render(Allocation);
		expect(screen.getByRole('button', { name: 'Refresh' })).toBeTruthy();
		expect(screen.getByPlaceholderText('Search...')).toBeTruthy();
		expect(screen.getByText('node-1')).toBeTruthy();
	});
});
