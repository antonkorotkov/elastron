// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import Header from './Header.svelte';

// Mock SvelteKit modules
vi.mock('$app/stores', () => {
	const { writable } = require('svelte/store');
	const pageStore = writable({ url: new URL('http://localhost/dashboard/indices') });
	return { page: pageStore };
});

vi.mock('$app/paths', () => ({
	resolve: (path) => path,
}));

vi.mock('$app/navigation', () => ({
	goto: vi.fn(),
}));

vi.mock('@storeon/svelte', () => ({
	useStoreon: () => {
		const { writable } = require('svelte/store');
		return {
			dispatch: vi.fn(),
			connection: writable({ name: 'Local Server' }),
			server: writable({ version: { number: '8.12.0' } }),
			internet: writable({ online: true }),
		};
	},
}));

// Mock svelte getContext for the modal
vi.mock('svelte', async (importOriginal) => {
	const actual = await importOriginal();
	return {
		...actual,
		getContext: () => ({ open: vi.fn() }),
	};
});

describe('Header', () => {
	beforeEach(() => {
		render(Header);
	});

	it('renders the app name', () => {
		expect(screen.getByText('Elastron')).toBeTruthy();
	});

	it('renders Dashboard navigation link', () => {
		const link = screen.getByText('Dashboard');
		expect(link.closest('a').getAttribute('href')).toBe('/dashboard/indices');
	});

	it('renders Search navigation link', () => {
		const link = screen.getByText('Search');
		expect(link.closest('a').getAttribute('href')).toBe('/search');
	});

	it('renders Connection button', () => {
		expect(screen.getByText('Connection')).toBeTruthy();
	});

	it('displays connection name', () => {
		expect(screen.getByText('Local Server')).toBeTruthy();
	});

	it('displays Elasticsearch version', () => {
		expect(screen.getByText('v8.12.0')).toBeTruthy();
	});
});
