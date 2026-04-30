// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import ButtonTinyBasic from './ButtonTinyBasic.svelte';
import { writable } from 'svelte/store';

vi.mock('@storeon/svelte', () => ({
	useStoreon: () => ({
		app: writable({ theme: 'light' }),
	}),
}));

vi.mock('$lib/utils/helpers', () => ({
	isThemeToggleChecked: (theme) => theme === 'dark',
}));

describe('ButtonTinyBasic', () => {
	it('renders with the given label', () => {
		render(ButtonTinyBasic, { label: 'Refresh', color: 'blue', loading: false, onClick: vi.fn() });
		expect(screen.getByText('Refresh')).toBeTruthy();
	});

	it('applies color class', () => {
		render(ButtonTinyBasic, { label: 'Create', color: 'green', loading: false, onClick: vi.fn() });
		const button = screen.getByRole('button');
		expect(button.className).toContain('green');
	});

	it('applies loading class when loading', () => {
		render(ButtonTinyBasic, { label: 'Wait', color: 'blue', loading: true, onClick: vi.fn() });
		const button = screen.getByRole('button');
		expect(button.className).toContain('loading');
	});

	it('does not apply loading class when not loading', () => {
		render(ButtonTinyBasic, { label: 'Go', color: 'blue', loading: false, onClick: vi.fn() });
		const button = screen.getByRole('button');
		expect(button.className).not.toContain('loading');
	});

	it('calls onClick when clicked', async () => {
		const user = userEvent.setup();
		const onClick = vi.fn();
		render(ButtonTinyBasic, { label: 'Click Me', color: 'blue', loading: false, onClick });
		await user.click(screen.getByRole('button'));
		expect(onClick).toHaveBeenCalledOnce();
	});
});
