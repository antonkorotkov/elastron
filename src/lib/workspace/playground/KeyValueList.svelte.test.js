// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import KeyValueList from './KeyValueList.svelte';
import { writable } from 'svelte/store';

vi.mock('@storeon/svelte', () => ({
	useStoreon: () => ({
		dispatch: vi.fn(),
		app: writable({ theme: 'light' }),
	}),
}));

vi.mock('$lib/utils/helpers', () => ({
	isThemeToggleChecked: (theme) => theme === 'dark',
}));

describe('KeyValueList', () => {
	it('renders with initial items', () => {
		render(KeyValueList, { items: [{ key: 'Authorization', value: 'token', enabled: true }] });
		const inputs = screen.getAllByRole('textbox');
		expect(inputs[0].value).toBe('Authorization');
		expect(inputs[1].value).toBe('token');
	});

	it('adds a new row when Add Row is clicked', async () => {
		render(KeyValueList, { items: [] });
		const addButton = screen.getByText('Add Row');
		await fireEvent.click(addButton);
		const inputs = screen.getAllByRole('textbox');
		expect(inputs.length).toBe(2); // One for key, one for value
	});

	it('deletes a row', async () => {
		render(KeyValueList, { items: [{ key: 'K', value: 'V', enabled: true }] });
		const deleteButton = screen.getByLabelText('Delete');
		await fireEvent.click(deleteButton);
		const inputs = screen.queryAllByRole('textbox');
		expect(inputs.length).toBe(0);
	});
});
