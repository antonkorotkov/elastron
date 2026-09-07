// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import SearchControls from './SearchControls.svelte';
import { writable } from 'svelte/store';

const mockDispatch = vi.fn();

vi.mock('@storeon/svelte', () => ({
	useStoreon: () => ({
		app: writable({ theme: 'light' }),
		dispatch: mockDispatch
	})
}));

const TAB = 'tab-1';

const tab = {
	id: TAB,
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
};

describe('SearchControls', () => {
	beforeEach(() => {
		mockDispatch.mockClear();
	});

	it('renders search statistics', () => {
		render(SearchControls, { tab, qEditor: {} });
		expect(screen.getByText('15')).toBeTruthy(); // total results
		expect(screen.getByText('5s')).toBeTruthy(); // time
	});

	it('renders view toggle buttons', () => {
		render(SearchControls, { tab, qEditor: {} });
		expect(screen.getByRole('button', { name: 'JSON' })).toBeTruthy();
		expect(screen.getByRole('button', { name: 'Table' })).toBeTruthy();
		expect(screen.getByRole('button', { name: 'Aggs' })).toBeTruthy();
		expect(screen.getByRole('button', { name: 'Raw' })).toBeTruthy();
	});

	it('dispatches view change against its tab on toggle click', async () => {
		const user = userEvent.setup();
		render(SearchControls, { tab, qEditor: {} });
		await user.click(screen.getByRole('button', { name: 'Raw' }));
		expect(mockDispatch).toHaveBeenCalledWith('search/update', {
			id: TAB,
			patch: { view: 'raw' }
		});
	});

	it('pages and re-runs against its tab', async () => {
		const user = userEvent.setup();
		render(SearchControls, { tab, qEditor: {} });

		await user.click(screen.getByRole('button', { name: 'Next' }));

		expect(mockDispatch).toHaveBeenCalledWith('search/update', {
			id: TAB,
			patch: { from: 10 }
		});
		expect(mockDispatch).toHaveBeenCalledWith('search/run', TAB);
	});
});
