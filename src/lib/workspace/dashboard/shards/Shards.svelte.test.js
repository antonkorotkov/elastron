// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import Shards from './Shards.svelte';
import { writable } from 'svelte/store';

const mockDispatch = vi.fn();

vi.mock('@storeon/svelte', () => ({
	useStoreon: () => ({
		app: writable({ theme: 'light' }),
		shards: writable({ data: [['test-idx', 0, 'STARTED']], columns: ['index', 'shard', 'state'], sorting: [], search: '', loading: false }),
		dispatch: mockDispatch
	})
}));

describe('Shards Dashboard Component', () => {
	it('renders table and controls', () => {
		render(Shards);
		expect(screen.getByRole('button', { name: 'Refresh' })).toBeTruthy();
		expect(screen.getByPlaceholderText('Search...')).toBeTruthy();
		expect(screen.getByText('test-idx')).toBeTruthy();
	});

	it('dispatches refresh action on click', async () => {
		const user = userEvent.setup();
		render(Shards);
		await user.click(screen.getByRole('button', { name: 'Refresh' }));
		expect(mockDispatch).toHaveBeenCalledWith('elasticsearch/shards/fetch');
	});
});
