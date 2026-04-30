// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import Notifications from './Notifications.svelte';
import { writable } from 'svelte/store';

vi.mock('@storeon/svelte', () => ({
	useStoreon: () => ({
		notifications: writable([
			{ id: 1, type: 'success', message: 'Ready' }
		]),
		dispatch: vi.fn(),
	})
}));

describe('Notifications', () => {
	it('renders a list of notifications', () => {
		render(Notifications);
		expect(screen.getByText('Ready')).toBeTruthy();
	});
});
