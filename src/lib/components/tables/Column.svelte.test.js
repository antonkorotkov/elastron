// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import Column from './Column.svelte';

describe('Column', () => {
	it('renders non-sortable column header', () => {
		const props = { column: 'Name', i: 0, sortable: false, sorting: [], onSort: vi.fn() };
		render(Column, props);
		expect(screen.getByText('NAME')).toBeTruthy();
		// Should not have sort arrows if not sortable
		expect(screen.queryByRole('button')).toBeFalsy();
	});
});
