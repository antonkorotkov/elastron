// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import Table from './Table.svelte';
import { writable } from 'svelte/store';

vi.mock('@storeon/svelte', () => ({
	useStoreon: () => ({
		app: writable({ theme: 'light' })
	})
}));

describe('Table', () => {
	it('renders empty message when no rows', () => {
		const columns = ['name'];
		render(Table, { columns, rows: [], emptyMessage: 'No data' });
		expect(screen.getByText('No data')).toBeTruthy();
	});

	it('renders table rows', () => {
		const columns = ['name'];
		const rows = [['Row 1'], ['Row 2']];
		render(Table, { columns, rows });
		expect(screen.getByText('Row 1')).toBeTruthy();
		expect(screen.getByText('Row 2')).toBeTruthy();
	});
});
