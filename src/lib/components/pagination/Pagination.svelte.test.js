// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import Pagination from './Pagination.svelte';

describe('Pagination', () => {
	it('does not render when total items fit on one page', () => {
		const { container } = render(Pagination, {
			current_page: 0,
			total_items: 5,
			items_per_page: 10,
			change: vi.fn(),
		});
		expect(container.querySelector('.pagination')).toBeNull();
	});

	it('renders when total items exceed items per page', () => {
		render(Pagination, {
			current_page: 0,
			total_items: 25,
			items_per_page: 10,
			change: vi.fn(),
		});
		expect(screen.getByText(/Page 1 of 3/)).toBeTruthy();
	});

	it('renders navigation buttons', () => {
		render(Pagination, {
			current_page: 1,
			total_items: 30,
			items_per_page: 10,
			change: vi.fn(),
		});
		expect(screen.getByLabelText('First')).toBeTruthy();
		expect(screen.getByLabelText('Previous')).toBeTruthy();
		expect(screen.getByLabelText('Next')).toBeTruthy();
		expect(screen.getByLabelText('Last')).toBeTruthy();
	});

	it('disables Previous/First on first page', () => {
		render(Pagination, {
			current_page: 0,
			total_items: 30,
			items_per_page: 10,
			change: vi.fn(),
		});
		expect(screen.getByLabelText('First').className).toContain('disabled');
		expect(screen.getByLabelText('Previous').className).toContain('disabled');
	});

	it('disables Next/Last on last page', () => {
		render(Pagination, {
			current_page: 2,
			total_items: 30,
			items_per_page: 10,
			change: vi.fn(),
		});
		expect(screen.getByLabelText('Next').className).toContain('disabled');
		expect(screen.getByLabelText('Last').className).toContain('disabled');
	});

	it('calls change callback when Next is clicked', async () => {
		const user = userEvent.setup();
		const change = vi.fn();
		render(Pagination, {
			current_page: 0,
			total_items: 30,
			items_per_page: 10,
			change,
		});
		await user.click(screen.getByLabelText('Next'));
		expect(change).toHaveBeenCalledWith(1);
	});

	it('calls change callback when Previous is clicked', async () => {
		const user = userEvent.setup();
		const change = vi.fn();
		render(Pagination, {
			current_page: 1,
			total_items: 30,
			items_per_page: 10,
			change,
		});
		await user.click(screen.getByLabelText('Previous'));
		expect(change).toHaveBeenCalledWith(0);
	});

	it('calls change with 0 when First is clicked', async () => {
		const user = userEvent.setup();
		const change = vi.fn();
		render(Pagination, {
			current_page: 2,
			total_items: 30,
			items_per_page: 10,
			change,
		});
		await user.click(screen.getByLabelText('First'));
		expect(change).toHaveBeenCalledWith(0);
	});

	it('calls change with last page when Last is clicked', async () => {
		const user = userEvent.setup();
		const change = vi.fn();
		render(Pagination, {
			current_page: 0,
			total_items: 30,
			items_per_page: 10,
			change,
		});
		await user.click(screen.getByLabelText('Last'));
		expect(change).toHaveBeenCalledWith(2);
	});
});
