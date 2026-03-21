// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import Error from './Error.svelte';

describe('Error notification', () => {
	it('renders Error header', () => {
		render(Error, { notification: { message: 'Something went wrong' } });
		expect(screen.getByText('Error')).toBeTruthy();
	});

	it('displays the error message', () => {
		render(Error, { notification: { message: 'Connection refused' } });
		expect(screen.getByText('Connection refused')).toBeTruthy();
	});
});
