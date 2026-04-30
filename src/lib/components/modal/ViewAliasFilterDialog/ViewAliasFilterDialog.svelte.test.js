// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import ViewAliasFilterDialog from './ViewAliasFilterDialog.svelte';
import { writable } from 'svelte/store';

vi.mock('@storeon/svelte', () => ({
	useStoreon: () => ({
		app: writable({ theme: 'light' })
	})
}));

vi.mock('svelte', async (importOriginal) => ({
	...(await importOriginal()),
	getContext: () => ({ close: vi.fn() })
}));

describe('ViewAliasFilterDialog', () => {
	it('renders filter string', () => {
		render(ViewAliasFilterDialog, { filter: '{"term": {"user" : "kimchy"}}' });
		expect(screen.getByText('{"term": {"user" : "kimchy"}}')).toBeTruthy();
		expect(screen.getByText('Alias Filter')).toBeTruthy();
	});
});
