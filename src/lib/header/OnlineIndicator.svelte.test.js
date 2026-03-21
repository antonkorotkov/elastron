// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import OnlineIndicator from './OnlineIndicator.svelte';
import { writable } from 'svelte/store';

let internetStore;

vi.mock('@storeon/svelte', () => ({
	useStoreon: () => ({
		internet: internetStore,
	}),
}));

describe('OnlineIndicator', () => {
	it('shows green indicator when online', () => {
		internetStore = writable({ online: true });
		render(OnlineIndicator);
		const indicator = screen.getByTitle('Online');
		expect(indicator).toBeTruthy();
		expect(indicator.className).toContain('green');
	});

	it('shows red indicator when offline', () => {
		internetStore = writable({ online: false });
		render(OnlineIndicator);
		const indicator = screen.getByTitle('Offline');
		expect(indicator).toBeTruthy();
		expect(indicator.className).toContain('red');
	});
});
