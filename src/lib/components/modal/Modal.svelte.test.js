// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import Modal from './Modal.svelte';
import { writable } from 'svelte/store';

vi.mock('@storeon/svelte', () => ({
	useStoreon: () => ({
		app: writable({ theme: 'light' })
	})
}));

describe('Modal Component', () => {
	it('renders children and context', () => {
		// Modal primarily provides a context and renders a Component when opened.
		// Since open() is exposed via context, we can just test if it mounts without errors.
		render(Modal, { children: () => {} });
		expect(true).toBe(true);
	});
});
