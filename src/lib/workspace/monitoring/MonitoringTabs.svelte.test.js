// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { readable, writable } from 'svelte/store';
import MonitoringTabs from './MonitoringTabs.svelte';

// Mock SvelteKit stores
vi.mock('$app/stores', () => ({
	page: readable({ url: { pathname: '/monitoring/overview' } })
}));

// Mock SvelteKit paths
vi.mock('$app/paths', () => ({
	resolve: (path) => path
}));

// Mock Storeon
vi.mock('@storeon/svelte', () => ({
	useStoreon: () => ({
		app: writable({ theme: 'light' })
	})
}));

describe('Monitoring Tabs Component', () => {
	it('renders navigation links', () => {
		render(MonitoringTabs);
		const overviewLink = screen.getByRole('link', { name: /overview/i });
		const nodesLink = screen.getByRole('link', { name: /nodes/i });
		
		expect(overviewLink).toBeTruthy();
		expect(nodesLink).toBeTruthy();
		expect(overviewLink.getAttribute('href')).toBe('/monitoring/overview');
		expect(nodesLink.getAttribute('href')).toBe('/monitoring/nodes');
	});
});
