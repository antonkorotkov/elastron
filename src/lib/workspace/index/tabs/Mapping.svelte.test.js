// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import MappingTab from './Mapping.svelte';
import { writable } from 'svelte/store';

vi.mock('@storeon/svelte', () => ({
	useStoreon: () => ({
		app: writable({ theme: 'light' }),
		index: writable({ selected: 'idx-1', info: { 'idx-1': { 'idx-1': { mappings: {} } } }, loading: false }),
		dispatch: vi.fn()
	})
}));

describe('Mapping Tab', () => {
	it('renders editor and buttons', () => {
		render(MappingTab);
		expect(screen.getByRole('button', { name: 'Update' })).toBeTruthy();
	});
});
