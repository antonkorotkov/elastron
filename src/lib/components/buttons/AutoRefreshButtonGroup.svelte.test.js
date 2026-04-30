// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import AutoRefreshButtonGroup from './AutoRefreshButtonGroup.svelte';

// Mock the INTERVALS since they are imported from monitoring
vi.mock('$lib/store/elasticsearch/monitoring', () => ({
	INTERVALS: [5000, 10000, 30000, 60000]
}));

describe('AutoRefreshButtonGroup', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('renders refresh and auto buttons', () => {
		render(AutoRefreshButtonGroup, {
			loading: false,
			autoRefresh: false,
			interval: 10000,
			inverted: false,
			onRefresh: vi.fn(),
			onAutoRefreshChange: vi.fn(),
			onIntervalChange: vi.fn()
		});

		expect(screen.getByText('Refresh')).toBeTruthy();
		expect(screen.getByText('Auto')).toBeTruthy();
		expect(screen.queryByRole('combobox')).toBeNull(); // Select should be hidden
	});

	it('renders interval select when autoRefresh is true', () => {
		render(AutoRefreshButtonGroup, {
			loading: false,
			autoRefresh: true,
			interval: 10000,
			inverted: false,
			onRefresh: vi.fn(),
			onAutoRefreshChange: vi.fn(),
			onIntervalChange: vi.fn()
		});

		const select = screen.getByRole('combobox');
		expect(select).toBeTruthy();
		expect(select.value).toBe('10000');
	});

	it('calls onRefresh when refresh button is clicked', async () => {
		const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
		const onRefresh = vi.fn();
		render(AutoRefreshButtonGroup, {
			loading: false,
			autoRefresh: false,
			interval: 10000,
			inverted: false,
			onRefresh,
			onAutoRefreshChange: vi.fn(),
			onIntervalChange: vi.fn()
		});

		await user.click(screen.getByText('Refresh'));
		expect(onRefresh).toHaveBeenCalledOnce();
	});

	it('calls onAutoRefreshChange when auto button is clicked', async () => {
		const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
		const onAutoRefreshChange = vi.fn();
		render(AutoRefreshButtonGroup, {
			loading: false,
			autoRefresh: false,
			interval: 10000,
			inverted: false,
			onRefresh: vi.fn(),
			onAutoRefreshChange,
			onIntervalChange: vi.fn()
		});

		await user.click(screen.getByText('Auto'));
		expect(onAutoRefreshChange).toHaveBeenCalledOnce();
	});

	it('triggers onRefresh on interval when autoRefresh is true', async () => {
		const onRefresh = vi.fn();
		render(AutoRefreshButtonGroup, {
			loading: false,
			autoRefresh: true,
			interval: 10000,
			inverted: false,
			onRefresh,
			onAutoRefreshChange: vi.fn(),
			onIntervalChange: vi.fn()
		});

		expect(onRefresh).not.toHaveBeenCalled();

		// Advance time by the interval
		vi.advanceTimersByTime(10000);
		expect(onRefresh).toHaveBeenCalledTimes(1);

		vi.advanceTimersByTime(10000);
		expect(onRefresh).toHaveBeenCalledTimes(2);
	});
});
