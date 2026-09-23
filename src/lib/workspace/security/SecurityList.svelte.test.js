// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { writable } from 'svelte/store';

// VirtualTable reads the theme through useStoreon, so the module is mocked the
// same way the other component tests in this project do it.
vi.mock('@storeon/svelte', () => ({
	useStoreon: () => ({ dispatch: vi.fn(), app: writable({ theme: 'light' }) }),
}));

import SecurityList from './SecurityList.svelte';

const base = {
	columns: ['name'],
	rows: [],
	entity: 'roles',
	emptyMessage: 'No roles found',
};

const renderList = props => render(SecurityList, { props: { ...base, ...props } });

beforeEach(() => {
	window.__IS_TEST__ = true;
	vi.useFakeTimers({ shouldAdvanceTime: true });
});
afterEach(() => {
	vi.useRealTimers();
});

describe('SecurityList', () => {
	it('shows neither the empty message nor an indicator immediately on a first load', () => {
		renderList({ loading: true, loaded: false });

		expect(screen.queryByText('No roles found')).toBeNull();
		expect(screen.getByTestId('security-list-loading').textContent.trim()).toBe('');
	});

	it('shows the indicator once the load runs past the delay', async () => {
		renderList({ loading: true, loaded: false, indicatorDelay: 200 });

		await vi.advanceTimersByTimeAsync(250);

		expect(screen.getByText(/Loading roles/)).toBeTruthy();
		expect(screen.queryByText('No roles found')).toBeNull();
	});

	it('never renders the indicator for a load that resolves within the delay', async () => {
		const { rerender } = renderList({ loading: true, loaded: false, indicatorDelay: 200 });

		await vi.advanceTimersByTimeAsync(50);
		await rerender({ ...base, loading: false, loaded: true, rows: [['viewer']] });
		await vi.advanceTimersByTimeAsync(500);

		expect(screen.queryByText(/Loading roles/)).toBeNull();
	});

	it('shows the empty message only after a load completes with no entries', async () => {
		renderList({ loading: false, loaded: true, rows: [] });
		expect(await screen.findByText('No roles found')).toBeTruthy();
	});

	it('keeps rows on screen when a refresh is outstanding', async () => {
		renderList({ loading: true, loaded: true, rows: [['viewer']] });

		expect(screen.queryByTestId('security-list-loading')).toBeNull();
		expect(await screen.findByText('viewer')).toBeTruthy();
	});

	it('replaces the table with the cause when there is nothing to show', () => {
		renderList({ loaded: true, cause: 'privilege', message: 'nope', rows: [] });

		expect(document.querySelector('[data-cause="privilege"]')).toBeTruthy();
		expect(screen.queryByText('No roles found')).toBeNull();
	});

	it('keeps the rows and shows no banner when a refresh fails', async () => {
		// The store reports this through the notification tray instead, which is
		// how every other failed action in the app surfaces.
		renderList({ loaded: true, cause: 'privilege', message: 'nope', rows: [['viewer']] });

		expect(document.querySelector('[data-cause="privilege"]')).toBeNull();
		expect(await screen.findByText('viewer')).toBeTruthy();
		expect(document.querySelector('.message')).toBeNull();
	});
});
