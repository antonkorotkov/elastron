// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import IndexSelector from './IndexSelector.svelte';
import { writable } from 'svelte/store';

vi.mock('@storeon/svelte', () => ({
	useStoreon: (key) => {
		if (key === 'indices') {
			return { indices: writable({ data: [{ index: 'test-index-1' }], columns: ['index'] }) };
		}
		if (key === 'app') {
			return { app: writable({ theme: 'light' }) };
		}
		return {};
	}
}));

describe('IndexSelector', () => {
	it('renders properly', () => {
		const { container } = render(IndexSelector, { placeholder: 'Select Index...' });
		expect(container.querySelector('.index-selector')).toBeTruthy();
	});
});
