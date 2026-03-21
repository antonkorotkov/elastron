// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import SearchTab from './Search.svelte';
import { writable } from 'svelte/store';

vi.mock('@storeon/svelte', () => ({
	useStoreon: () => ({
		app: writable({ theme: 'light' }),
		search: writable({ results: {}, loading: false }),
		indices: writable({ data: [], columns: [] }),
		server: writable({ version: { number: '8.0.0' } }),
		dispatch: vi.fn()
	})
}));

describe('Search Tab', () => {
	it('renders correctly', () => {
		const { container } = render(SearchTab, { search: { query: [], collector: [] } });
		expect(container).toBeTruthy();
	});
});
