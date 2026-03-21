// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import StatusTab from './Status.svelte';
import { writable } from 'svelte/store';

vi.mock('@storeon/svelte', () => ({
	useStoreon: () => ({
		app: writable({ theme: 'light' }),
		index: writable({ selected: 'idx-1', status: { 'idx-1': { _shards: {} } }, loading: false }),
		dispatch: vi.fn()
	})
}));

describe('Status Tab', () => {
	it('renders comming soon placeholder', () => {
		render(StatusTab);
		expect(screen.getByText('Comming soon')).toBeTruthy();
	});
});
