// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/svelte';
import QueryTab from './Query.svelte';
import { writable } from 'svelte/store';

vi.mock('@storeon/svelte', () => ({
	useStoreon: () => ({
		app: writable({ theme: 'light' }),
		search: writable({ request: {}, loading: false }),
		server: writable({ version: '8.0.0' }),
		dispatch: vi.fn()
	})
}));

describe('Query Tab', () => {
	it('renders correctly', () => {
		const { container } = render(QueryTab, { query: { breakdown: {} }, queries: [] });
		expect(container).toBeTruthy();
	});
});
