import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createStoreon } from 'storeon';
import { app } from './app';

// Mock setStorage to track calls without needing window.electron
vi.mock('../utils/storage', () => ({
	setStorage: vi.fn(),
	getStorage: vi.fn(),
}));

describe('app store module', () => {
	let store;

	beforeEach(() => {
		store = createStoreon([app]);
	});

	it('initializes with light theme', () => {
		expect(store.get().app.theme).toBe('light');
	});

	it('hydrates app state', () => {
		store.dispatch('app/hydrate', { theme: 'dark' });
		expect(store.get().app.theme).toBe('dark');
	});

	it('hydrate merges without losing existing keys', () => {
		store.dispatch('app/hydrate', { theme: 'dark' });
		store.dispatch('app/hydrate', { extra: true });
		const state = store.get().app;
		expect(state.theme).toBe('dark');
		expect(state.extra).toBe(true);
	});

	it('toggles theme', () => {
		store.dispatch('app/toggleTheme', 'dark');
		expect(store.get().app.theme).toBe('dark');
		store.dispatch('app/toggleTheme', 'light');
		expect(store.get().app.theme).toBe('light');
	});
});
