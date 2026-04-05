// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import HeaderItem from './HeaderItem.svelte';
import { writable } from 'svelte/store';

vi.mock('@storeon/svelte', () => ({
	useStoreon: () => ({
		app: writable({ theme: 'light' })
	})
}));

describe('HeaderItem', () => {
	it('renders inputs with name and value', () => {
		render(HeaderItem, { name: 'Authorization', value: 'Bearer token' });
		expect(screen.getByDisplayValue('Authorization')).toBeTruthy();
		expect(screen.getByDisplayValue('Bearer token')).toBeTruthy();
	});
});
