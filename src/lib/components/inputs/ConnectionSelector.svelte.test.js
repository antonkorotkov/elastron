// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/svelte';
import ConnectionSelector from './ConnectionSelector.svelte';
import { writable } from 'svelte/store';

vi.mock('@storeon/svelte', () => ({
	useStoreon: (key) => {
		if (key === 'connections') {
			return { connections: writable({ connection: [{ name: 'Local Dev' }] }) };
		}
		if (key === 'app') {
			return { app: writable({ theme: 'light' }) };
		}
		return {};
	}
}));

describe('ConnectionSelector', () => {
	it('renders with placeholder', () => {
		const { container } = render(ConnectionSelector, { currentlySelected: null });
		expect(container.querySelector('.connection-selector')).toBeTruthy();
	});
});
