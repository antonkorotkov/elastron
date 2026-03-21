// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import CreateAliasDialog from './CreateAliasDialog.svelte';
import { writable } from 'svelte/store';

vi.mock('@storeon/svelte', () => ({
	useStoreon: () => ({
		app: writable({ theme: 'light' }),
		connection: writable({}),
		index: writable({ selected: 'idx-1' }),
		dispatch: vi.fn()
	})
}));

vi.mock('svelte', async (importOriginal) => ({
	...(await importOriginal()),
	getContext: () => ({ close: vi.fn() })
}));

describe('CreateAliasDialog', () => {
	it('renders form', () => {
		render(CreateAliasDialog, { aliases: {} });
		expect(screen.getByText('Create New Alias')).toBeTruthy();
		expect(screen.getByLabelText('Alias Name')).toBeTruthy();
	});
});
