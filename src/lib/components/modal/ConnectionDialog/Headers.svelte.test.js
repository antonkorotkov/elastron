// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import Headers from './Headers.svelte';

describe('Headers', () => {
	it('renders multiple HeaderItems', () => {
		const headers = [
			{ name: 'Auth', value: '123' },
			{ name: 'Content-Type', value: 'application/json' }
		];
		render(Headers, { headers, onAdd: vi.fn(), onDelete: vi.fn(), onChange: vi.fn() });
		expect(screen.getByDisplayValue('Auth')).toBeTruthy();
		expect(screen.getByDisplayValue('123')).toBeTruthy();
		expect(screen.getByDisplayValue('Content-Type')).toBeTruthy();
		expect(screen.getByDisplayValue('application/json')).toBeTruthy();
	});
});
