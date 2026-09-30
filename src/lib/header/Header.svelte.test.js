// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import { tick } from 'svelte';
import Header from './Header.svelte';

const stores = vi.hoisted(() => ({ connection: null, server: null, assistant: null, open: null, dispatch: null }));

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
	stores.server = writable({ version: '8.12.0', reachable: true });
	stores.assistant = writable({ open: false });
	return {
		useStoreon: () => ({
			dispatch: (...args) => stores.dispatch(...args),
			connection: stores.connection,
			assistant: stores.assistant,
			server: stores.server,
			search: writable({ tabs: [], activeId: 'tab-1' }),
		}),
	};
});

// Mock svelte getContext for the modal
vi.mock('svelte', async (importOriginal) => {
	const actual = await importOriginal();
	return {
		...actual,
		getContext: () => ({ open: (...args) => stores.open(...args) }),
	};
});

describe('Header', () => {
	beforeEach(() => {
		stores.connection.set({ name: 'Local Server' });
		stores.server.set({ version: '8.12.0', reachable: true });
		stores.open = vi.fn();
		stores.dispatch = vi.fn();
		stores.assistant.set({ open: false });
		render(Header);
	});

	it('renders the app name', () => {
		expect(screen.getByText('Elastron')).toBeTruthy();
	});

	it('renders Dashboard navigation link', () => {
		const link = screen.getByText('Dashboard');
		expect(link.closest('a').getAttribute('href')).toBe('/dashboard/indices');
	});

	// The security entry is deliberately unconditional: Elastron does not probe
	// the cluster for what the account may do, so the entry must not appear and
	// disappear with privileges or with security being enabled.
	it('renders Security navigation link', () => {
		const link = screen.getByText('Security');
		expect(link.closest('a').getAttribute('href')).toBe('/security/users');
	});

	it('renders Search navigation link', () => {
		const link = screen.getByText('Search');
		expect(link.closest('a').getAttribute('href')).toBe('/search');
	});

	describe('connection icon', () => {
		const icon = () =>
			screen.getByRole('button', { name: 'Connection' }).querySelector('i.plug.icon');

		it('replaces the Connection text button', () => {
			expect(screen.queryByText('Connection')).toBeNull();
			expect(icon()).toBeTruthy();
		});

		it('is green while the cluster is reachable', () => {
			expect(icon().classList.contains('green')).toBe(true);
			expect(icon().classList.contains('red')).toBe(false);
		});

		it('is red while the cluster is unreachable', async () => {
			stores.server.set({ version: '8.12.0', reachable: false });
			await tick();
			expect(icon().classList.contains('red')).toBe(true);
			expect(icon().classList.contains('green')).toBe(false);
		});

		it('keeps its color on hover', async () => {
			await fireEvent.mouseOver(icon());
			await fireEvent.mouseOut(icon());
			await fireEvent.mouseOver(icon());
			expect(icon().classList.contains('green')).toBe(true);
		});

		it('is not a window drag region', () => {
			const button = screen.getByRole('button', { name: 'Connection' });
			expect(button.getAttribute('style')).toContain('no-drag');
		});

		it('opens the connection dialog on click', async () => {
			const { default: ConnectDialog } = await import(
				'../components/modal/ConnectionDialog/ConnectDialog.svelte'
			);
			await fireEvent.click(screen.getByRole('button', { name: 'Connection' }));
			await waitFor(() => expect(stores.open).toHaveBeenCalled());
			expect(stores.open.mock.calls[0][0]).toBe(ConnectDialog);
		});
	});

	it('displays connection name', () => {
		expect(screen.getByText('Local Server')).toBeTruthy();
	});

	it('displays Elasticsearch version', () => {
		expect(screen.getByText('v8.12.0')).toBeTruthy();
	});

	describe('assistant button', () => {
		it('toggles the assistant drawer', async () => {
			await fireEvent.click(screen.getByRole('button', { name: 'Assistant' }));
			expect(stores.dispatch).toHaveBeenCalledWith('assistant/toggle');
		});

		it('shows whether the drawer is open', async () => {
			const button = screen.getByRole('button', { name: 'Assistant' });
			expect(button.getAttribute('aria-pressed')).toBe('false');
			stores.assistant.set({ open: true });
			await tick();
			expect(button.getAttribute('aria-pressed')).toBe('true');
			expect(button.classList.contains('active')).toBe(true);
		});

		it('is not a window drag region', () => {
			expect(screen.getByRole('button', { name: 'Assistant' }).getAttribute('style')).toContain('no-drag');
		});

		it('shows the AI sparkles icon rather than a chat icon', () => {
			const button = screen.getByRole('button', { name: 'Assistant' });
			expect(button.querySelector('svg.ai-sparkles')).toBeTruthy();
			expect(button.querySelector('i.comments')).toBeNull();
		});
	});

	describe('settings button', () => {
		it('is not a window drag region', () => {
			const button = screen.getByRole('button', { name: 'Settings' });
			expect(button.getAttribute('style')).toContain('no-drag');
		});

		it('opens the settings dialog on click', async () => {
			const { default: SettingsDialog } = await import(
				'../components/modal/SettingsDialog/SettingsDialog.svelte'
			);
			await fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
			await waitFor(() => expect(stores.open).toHaveBeenCalled());
			expect(stores.open.mock.calls[0][0]).toBe(SettingsDialog);
		});
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
