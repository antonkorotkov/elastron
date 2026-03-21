// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/svelte';
import AggregationsTab from './Aggregations.svelte';
import { writable } from 'svelte/store';

vi.mock('@storeon/svelte', () => ({
	useStoreon: () => ({
		app: writable({ theme: 'light' }),
		search: writable({ request: {}, loading: false }),
		server: writable({ version: { number: '8.0.0' } }),
		dispatch: vi.fn()
	})
}));

describe('Aggregations Tab', () => {
	it('renders correctly', () => {
		const { container } = render(AggregationsTab, { agg: { children: [], name: 'test', breakdown: {} } });
		expect(container).toBeTruthy();
	});
});
