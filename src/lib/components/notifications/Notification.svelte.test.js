// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import Notification from './Notification.svelte';


vi.mock('@storeon/svelte', () => ({
	useStoreon: () => ({ dispatch: vi.fn() })
}));

describe('Notification', () => {
	it('renders error notification', () => {
		Element.prototype.animate = vi.fn().mockImplementation(() => ({
			onfinish: vi.fn(),
			cancel: vi.fn()
		}));
		const notification = { id: 1, type: 'error', message: 'Test error' };
		render(Notification, { notification });
		expect(screen.getByText('Error')).toBeTruthy();
		expect(screen.getByText('Test error')).toBeTruthy();
	});

	it('renders success notification', () => {
		Element.prototype.animate = vi.fn().mockImplementation(() => ({
			onfinish: vi.fn(),
			cancel: vi.fn()
		}));
		const notification = { id: 2, type: 'success', message: 'Test success' };
		render(Notification, { notification });
		expect(screen.getByText('Success')).toBeTruthy();
		expect(screen.getByText('Test success')).toBeTruthy();
	});
});
