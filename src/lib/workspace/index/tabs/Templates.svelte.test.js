// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import TemplatesTab from './Templates.svelte';
import { writable } from 'svelte/store';

vi.mock('@storeon/svelte', () => ({
	useStoreon: () => ({
		app: writable({ theme: 'light' }),
		connection: writable({ uri: '' }),
		indices: writable({ templateList: ['template-1'] }),
		index: writable({ loading: false }),
		dispatch: vi.fn()
	})
}));

describe('Templates Tab', () => {
	it('renders comming soon placeholder', () => {
		render(TemplatesTab);
		expect(screen.getByText('Comming soon')).toBeTruthy();
	});
});
