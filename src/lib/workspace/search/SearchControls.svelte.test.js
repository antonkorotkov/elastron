// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import SearchControls from './SearchControls.svelte';
import { writable } from 'svelte/store';

const mockDispatch = vi.fn();

vi.mock('@storeon/svelte', () => ({
	useStoreon: () => ({
		app: writable({ theme: 'light' }),
		search: writable({
			stats: { total_results: 15, time: 5000, total_shards: 1, successful_shards: 1, skipped_shards: 0, failed_shards: 0 },
			view: 'hits',
			results: [{}],
			aggs: {},
			response: {},
			profile: {},
			type: 'uri',
			loading: false,
			from: 0,
			size: 10
		}),
		dispatch: mockDispatch
	})
}));

describe('SearchControls', () => {
	it('renders search statistics', () => {
		render(SearchControls, { qEditor: {} });
		expect(screen.getByText('15')).toBeTruthy(); // total results
		expect(screen.getByText('5s')).toBeTruthy(); // time
	});

	it('renders view toggle buttons', () => {
		render(SearchControls, { qEditor: {} });
		expect(screen.getByRole('button', { name: 'Hits' })).toBeTruthy();
		expect(screen.getByRole('button', { name: 'Aggs' })).toBeTruthy();
		expect(screen.getByRole('button', { name: 'Raw' })).toBeTruthy();
	});
	
	it('dispatches view change on toggle click', async () => {
		const user = userEvent.setup();
		render(SearchControls, { qEditor: {} });
		await user.click(screen.getByRole('button', { name: 'Raw' }));
		expect(mockDispatch).toHaveBeenCalledWith('search/update', { view: 'raw' });
	});
});
