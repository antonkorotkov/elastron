// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import Footer from './Footer.svelte';
import { writable } from 'svelte/store';

vi.mock('@storeon/svelte', () => ({
	useStoreon: () => ({
		dispatch: vi.fn(),
		app: writable({ theme: 'light' }),
	}),
}));

vi.mock('$lib/utils/helpers', () => ({
	isThemeToggleChecked: (theme) => theme === 'dark',
}));

describe('Footer', () => {
	beforeEach(() => {
		render(Footer);
	});

	it('displays the version number', () => {
		expect(screen.getByText(/v\d+\.\d+\.\d+/)).toBeTruthy();
	});

	it('displays the author link', () => {
		const link = screen.getByText('@antonkorotkov');
		expect(link.closest('a').getAttribute('href')).toBe('https://github.com/antonkorotkov');
		expect(link.closest('a').getAttribute('target')).toBe('_blank');
	});

	it('renders the theme toggle checkbox', () => {
		const toggle = screen.getByRole('checkbox');
		expect(toggle).toBeTruthy();
		expect(toggle.getAttribute('name')).toBe('theme');
	});
});
