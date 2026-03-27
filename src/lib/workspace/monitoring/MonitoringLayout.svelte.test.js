// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import { readable, writable } from 'svelte/store';
import MonitoringLayout from './MonitoringLayout.svelte';

const mockDispatch = vi.fn();

// Mock SvelteKit stores
vi.mock('$app/stores', () => ({
	page: readable({ url: { pathname: '/monitoring/overview' } })
}));

// Mock SvelteKit paths
vi.mock('$app/paths', () => ({
	resolve: (path) => path
}));

vi.mock('@storeon/svelte', () => ({
	useStoreon: () => ({
		app: writable({ theme: 'light' }),
		monitoring: writable({
			autoRefresh: true,
			interval: 10000,
			errorMessage: null,
			polling: false
		}),
		dispatch: mockDispatch
	})
}));

describe('Monitoring Layout Component', () => {
	it('renders controls and tab bar', () => {
		render(MonitoringLayout);
		expect(screen.getByText('Overview')).toBeTruthy();
		expect(screen.getByText('Nodes')).toBeTruthy();
		expect(screen.getByText('Auto-refresh')).toBeTruthy();
		expect(screen.getByRole('combobox')).toBeTruthy();
	});

	it('triggers monitoring/config when auto-refresh toggle is clicked', async () => {
		render(MonitoringLayout);
		const refreshBtn = screen.getByTitle('Pause auto-refresh');
		await fireEvent.click(refreshBtn);
		expect(mockDispatch).toHaveBeenCalledWith('monitoring/config', expect.objectContaining({
			autoRefresh: false
		}));
	});
});
