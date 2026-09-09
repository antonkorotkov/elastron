// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import Footer from './Footer.svelte';
import { writable } from 'svelte/store';

const updaterState = writable({ downloading: false, percent: 0, downloaded: false });
const dispatchMock = vi.fn();

vi.mock('@storeon/svelte', () => ({
	useStoreon: () => ({
		dispatch: dispatchMock,
		app: writable({ theme: 'light' }),
		updater: updaterState,
	}),
}));

vi.mock('$lib/utils/helpers', () => ({
	isThemeToggleChecked: (theme) => theme === 'dark',
}));

describe('Footer', () => {
	beforeEach(() => {
		dispatchMock.mockClear();
		updaterState.set({ downloading: false, percent: 0, downloaded: false });
	});

	it('displays the version number in the idle state', () => {
		render(Footer);
		expect(screen.getByText(/v\d+\.\d+\.\d+/)).toBeTruthy();
	});

	it('displays the author link', () => {
		render(Footer);
		const link = screen.getByText('@antonkorotkov');
		expect(link.closest('a').getAttribute('href')).toBe('https://github.com/antonkorotkov');
		expect(link.closest('a').getAttribute('target')).toBe('_blank');
	});

	it('renders the theme toggle checkbox', () => {
		render(Footer);
		const toggle = screen.getByRole('checkbox');
		expect(toggle).toBeTruthy();
		expect(toggle.getAttribute('name')).toBe('theme');
	});

	it('shows a progress bar instead of the version while downloading', () => {
		updaterState.set({ downloading: true, percent: 42, downloaded: false });
		render(Footer);
		expect(screen.queryByText(/v\d+\.\d+\.\d+/)).toBeNull();
		expect(screen.getByText('42%')).toBeTruthy();
	});

	it('shows a restart button once the update has downloaded', async () => {
		updaterState.set({ downloading: false, percent: 100, downloaded: true });
		render(Footer);
		expect(screen.getByText(/v\d+\.\d+\.\d+/)).toBeTruthy();
		const button = screen.getByText('Restart to update');
		expect(button).toBeTruthy();

		await button.click();
		expect(dispatchMock).toHaveBeenCalledWith('updater/restart');
	});
});
