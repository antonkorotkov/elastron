// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/svelte';
import SearchTab from './Search.svelte';
import { writable } from 'svelte/store';

vi.mock('@storeon/svelte', () => ({
	useStoreon: () => ({
		app: writable({ theme: 'light' }),
		search: writable({ results: {}, stats: { total_results: 0, time: 0 }, loading: false }),
		indices: writable({ data: [['idx', 'yellow', 'open']], columns: ['index', 'health', 'status'] }),
		connection: writable({}),
		server: writable({ version: { number: '8.0.0' } }),
		dispatch: vi.fn()
	})
}));

describe('Search Tab', () => {
	it('renders correctly', () => {
		const { container } = render(SearchTab);
		expect(container).toBeTruthy();
	});
});
