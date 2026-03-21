// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import MonitoringTab from './Monitoring.svelte';
import { writable } from 'svelte/store';

vi.mock('@storeon/svelte', () => ({
	useStoreon: () => ({
		app: writable({ theme: 'light' }),
		index: writable({ selected: 'idx-1', stats: { 'idx-1': { 'idx-1': {} } }, loading: false }),
		dispatch: vi.fn()
	})
}));

describe('Monitoring Tab', () => {
	it('renders comming soon placeholder', () => {
		render(MonitoringTab);
		expect(screen.getByText('Comming soon')).toBeTruthy();
	});
});
