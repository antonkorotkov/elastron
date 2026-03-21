// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import RowCell from './RowCell.svelte';

describe('RowCell', () => {
	it('renders correctly', () => {
		const columns = ['name'];
		const cell = 'test-value';
		render(RowCell, { columns, cell, i: 0 });
		expect(screen.getByText('test-value')).toBeTruthy();
	});
});
