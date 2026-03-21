// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import Cell from './Cell.svelte';

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

	it('renders other columns as plain text', () => {
		render(Cell, { cell: '123', i: 0, columns: ['docs.count'] });
		expect(screen.getByText('123')).toBeTruthy();
	});
});
