// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import Cell from './Cell.svelte';

beforeEach(() => {
	Object.assign(navigator, {
		clipboard: {
			writeText: vi.fn().mockResolvedValue(undefined),
		},
	});
});

describe('Dashboard Indices Cell', () => {
	it('renders health column as a colored label', () => {
		const { container } = render(Cell, { cell: 'green', i: 0, columns: ['health'] });
		const label = container.querySelector('.label');
		expect(label.className).toContain('green');
	});

	it('renders index column as a link', () => {
		render(Cell, { cell: 'my-index', i: 0, columns: ['index'] });
		const link = screen.getByText('my-index');
		expect(link.tagName).toBe('A');
		expect(link.getAttribute('href')).toBe('/index/my-index');
	});

	it('renders a copy button in index column', () => {
		const { container } = render(Cell, { cell: 'my-index', i: 0, columns: ['index'] });
		const btn = container.querySelector('.copy-btn');
		expect(btn).toBeTruthy();
		expect(btn.querySelector('i').className).toContain('copy outline');
	});

	it('copies index name to clipboard on click', async () => {
		const { container } = render(Cell, { cell: 'my-index', i: 0, columns: ['index'] });
		const btn = container.querySelector('.copy-btn');
		await fireEvent.click(btn);
		expect(navigator.clipboard.writeText).toHaveBeenCalledWith('my-index');
	});

	it('renders other columns as plain text', () => {
		render(Cell, { cell: '123', i: 0, columns: ['docs.count'] });
		expect(screen.getByText('123')).toBeTruthy();
	});
});
