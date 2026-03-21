// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import SettingsTab from './Settings.svelte';
import { writable } from 'svelte/store';

vi.mock('@storeon/svelte', () => ({
	useStoreon: () => ({
		app: writable({ theme: 'light' }),
		index: writable({ selected: 'idx-1', info: { 'idx-1': { 'idx-1': { settings: {} } } }, loading: false }),
		dispatch: vi.fn()
	})
}));

describe('Settings Tab', () => {
	it('renders editor and buttons', () => {
		render(SettingsTab);
		expect(screen.getByRole('button', { name: 'Update' })).toBeTruthy();
	});
});
