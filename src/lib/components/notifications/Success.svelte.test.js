// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import Success from './Success.svelte';

describe('Success notification', () => {
	it('renders Success header', () => {
		render(Success, { notification: { message: 'Connected' } });
		expect(screen.getByText('Success')).toBeTruthy();
	});

	it('displays the success message', () => {
		render(Success, { notification: { message: 'Connected to the server' } });
		expect(screen.getByText('Connected to the server')).toBeTruthy();
	});
});
