// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import IconButton from './IconButton.svelte';

describe('IconButton', () => {
	it('renders with the given class name', () => {
		render(IconButton, { onClick: vi.fn(), className: 'trash alternate' });
		const button = screen.getByRole('button');
		expect(button.className).toContain('trash');
		expect(button.className).toContain('alternate');
	});

	it('applies loading class when loading', () => {
		render(IconButton, { onClick: vi.fn(), className: 'sync', loading: true });
		const button = screen.getByRole('button');
		expect(button.className).toContain('loading');
	});

	it('renders with title attribute', () => {
		render(IconButton, { onClick: vi.fn(), className: 'sync', title: 'Refresh data' });
		const button = screen.getByTitle('Refresh data');
		expect(button).toBeTruthy();
	});

	it('calls onClick when clicked', async () => {
		const user = userEvent.setup();
		const onClick = vi.fn();
		render(IconButton, { onClick, className: 'play' });
		await user.click(screen.getByRole('button'));
		expect(onClick).toHaveBeenCalledOnce();
	});
});
