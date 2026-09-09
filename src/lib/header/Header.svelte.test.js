// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import Header from './Header.svelte';

const stores = vi.hoisted(() => ({ connection: null }));

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

vi.mock('@storeon/svelte', () => {
	const { writable } = require('svelte/store');
	stores.connection = writable({ name: 'Local Server' });
	return {
		useStoreon: () => ({
			dispatch: vi.fn(),
			connection: stores.connection,
			server: writable({ version: '8.12.0' }),
			internet: writable({ online: true }),
			search: writable({ tabs: [], activeId: 'tab-1' }),
		}),
	};
});

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
		stores.connection.set({ name: 'Local Server' });
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

	describe('connection color', () => {
		const setConnection = async connection => {
			stores.connection.set(connection);
			await tick();
		};

		it('renders neither pill nor strip for an uncolored connection', () => {
			expect(document.querySelector('.connection-pill')).toBeNull();
			expect(document.querySelector('.connection-strip')).toBeNull();
		});

		it('renders neither pill nor strip when the color is empty', async () => {
			await setConnection({ name: 'Local Server', color: '' });

			expect(document.querySelector('.connection-pill')).toBeNull();
			expect(document.querySelector('.connection-strip')).toBeNull();
		});

		it('renders the pill in the connection color', async () => {
			await setConnection({ name: 'Production', color: '#db2828' });

			const pill = document.querySelector('.connection-pill');
			expect(pill.textContent.trim()).toBe('Production');
			expect(pill.style.background).toBe('rgb(219, 40, 40)');
		});

		it('renders the strip in the connection color', async () => {
			await setConnection({ name: 'Production', color: '#db2828' });

			const strip = document.querySelector('.connection-strip');
			expect(strip).toBeTruthy();
			expect(strip.style.background).toBe('rgb(219, 40, 40)');
		});

		it('picks pill text that contrasts with the color', async () => {
			await setConnection({ name: 'Staging', color: '#fbbd08' });
			expect(document.querySelector('.connection-pill').style.color).toBe(
				'rgb(0, 0, 0)'
			);

			await setConnection({ name: 'Production', color: '#db2828' });
			expect(document.querySelector('.connection-pill').style.color).toBe(
				'rgb(255, 255, 255)'
			);
		});

		it('shows no pill when there is no connection name', async () => {
			await setConnection({ name: '', color: '#db2828' });

			expect(document.querySelector('.connection-pill')).toBeNull();
			// The strip is driven by the color alone. Quick Connect sessions
			// clear the color explicitly rather than relying on this, since
			// connection/update merges over the previous connection.
			expect(document.querySelector('.connection-strip')).toBeTruthy();
		});
	});
});
