// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/svelte';
import AdvancedDropdown from './AdvancedDropdown.svelte';
import { writable } from 'svelte/store';

vi.mock('@storeon/svelte', () => ({
	useStoreon: () => ({
		app: writable({ theme: 'light' })
	})
}));

describe('AdvancedDropdown', () => {
	it('renders with placeholder', () => {
		const { container } = render(AdvancedDropdown, { placeholder: 'Select custom item...' });
		expect(container.querySelector('.advanced-selector')).toBeTruthy();
	});
});
