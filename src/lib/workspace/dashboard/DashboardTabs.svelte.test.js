// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import DashboardTabs from './DashboardTabs.svelte';

// Mock SvelteKit modules
vi.mock('$app/stores', () => {
	const { writable } = require('svelte/store');
	const pageStore = writable({ url: new URL('http://localhost/dashboard/indices') });
	return { page: pageStore };
});

vi.mock('$app/paths', () => ({
	resolve: (path) => path,
}));

vi.mock('@storeon/svelte', () => ({
	useStoreon: () => {
		const { writable } = require('svelte/store');
		return { app: writable({ theme: 'light' }) };
	},
}));

vi.mock('$lib/utils/helpers', () => ({
	isThemeToggleChecked: (theme) => theme === 'dark',
}));

describe('DashboardTabs', () => {
	beforeEach(() => {
		render(DashboardTabs);
	});

	it('renders three tab links', () => {
		const links = screen.getAllByRole('link');
		expect(links).toHaveLength(3);
	});

	it('renders Indices link with correct href', () => {
		const link = screen.getByText('Indices');
		expect(link.closest('a').getAttribute('href')).toBe('/dashboard/indices');
	});

	it('renders Shards link with correct href', () => {
		const link = screen.getByText('Shards');
		expect(link.closest('a').getAttribute('href')).toBe('/dashboard/shards');
	});

	it('renders Allocation link with correct href', () => {
		const link = screen.getByText('Allocation');
		expect(link.closest('a').getAttribute('href')).toBe('/dashboard/allocation');
	});
});
