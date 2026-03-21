// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import AliasTableCell from './AliasTableCell.svelte';
import { writable } from 'svelte/store';

vi.mock('@storeon/svelte', () => ({
	useStoreon: () => ({
		connection: writable({}),
		index: writable({ selected: 'my-index', info: { 'my-index': { 'my-index': { aliases: {} } } } }),
		dispatch: vi.fn(),
	})
}));

vi.mock('svelte', async (importOriginal) => {
	const actual = await importOriginal();
	return {
		...actual,
		getContext: (key) => {
			if (key === 'modal-window') return { open: vi.fn() };
			return null;
		}
	};
});

describe('AliasTableCell', () => {
	it('renders plain text for normal columns', () => {
		render(AliasTableCell, { cell: 'test-alias', i: 0, columns: ['Alias'] });
		expect(screen.getByText('test-alias')).toBeTruthy();
	});

	it('renders action buttons for Actions column', () => {
		render(AliasTableCell, { cell: 'test-alias', i: 0, columns: ['Actions'] });
		expect(screen.getByRole('button', { name: 'Update' })).toBeTruthy();
		expect(screen.getByRole('button', { name: 'Delete' })).toBeTruthy();
	});

	it('renders View button for Filter column if cell has length', () => {
		render(AliasTableCell, { cell: '{"term": {"user" : "kimchy"}}', i: 0, columns: ['Filter'] });
		expect(screen.getByRole('button', { name: 'View' })).toBeTruthy();
	});
});
