// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import HeaderItem from './HeaderItem.svelte';

describe('HeaderItem', () => {
	it('renders inputs with name and value', () => {
		render(HeaderItem, { name: 'Authorization', value: 'Bearer token' });
		expect(screen.getByDisplayValue('Authorization')).toBeTruthy();
		expect(screen.getByDisplayValue('Bearer token')).toBeTruthy();
	});
});
