// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/svelte';
import CollectorTab from './Collector.svelte';
import { writable } from 'svelte/store';

vi.mock('@storeon/svelte', () => ({
	useStoreon: () => ({
		app: writable({ theme: 'light' }),
		search: writable({ request: {}, loading: false }),
		server: writable({ version: '8.0.0' }),
		dispatch: vi.fn()
	})
}));

describe('Collector Tab', () => {
	it('renders correctly', () => {
		const { container } = render(CollectorTab, { collector: { children: [], name: 'test', time_in_nanos: 0 }, collectors: [] });
		expect(container).toBeTruthy();
	});
});
