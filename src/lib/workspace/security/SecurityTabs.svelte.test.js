// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { readable, writable } from 'svelte/store';
import SecurityTabs from './SecurityTabs.svelte';

vi.mock('$app/stores', () => ({
	page: readable({ url: { pathname: '/security/role-mappings' } }),
}));

vi.mock('$app/paths', () => ({
	resolve: path => path,
}));

vi.mock('@storeon/svelte', () => ({
	useStoreon: () => ({ app: writable({ theme: 'light' }) }),
}));

describe('SecurityTabs', () => {
	it('offers role mappings between roles and API keys, marking it active on its route', () => {
		render(SecurityTabs);
		const links = screen.getAllByRole('link');

		expect(links.map(link => link.textContent.trim())).toEqual(['Users', 'Roles', 'Role mappings', 'API keys']);
		const mappings = screen.getByRole('link', { name: 'Role mappings' });
		expect(mappings.getAttribute('href')).toBe('/security/role-mappings');
		expect(mappings.classList.contains('active')).toBe(true);
		expect(screen.getByRole('link', { name: 'Roles' }).classList.contains('active')).toBe(false);
	});
});
