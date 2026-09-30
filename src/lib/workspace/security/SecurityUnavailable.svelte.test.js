// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import { writable } from 'svelte/store';

vi.mock('@storeon/svelte', () => ({
	useStoreon: () => ({ dispatch: vi.fn(), app: writable({ theme: 'light' }) }),
}));

import SecurityUnavailable from './SecurityUnavailable.svelte';
import { CAUSE } from '$lib/security/causes.js';

// The exact string a cluster with security disabled answers a user listing
// with. It must never be what the user is told.
const MISLEADING =
	'Incorrect HTTP method for uri [/_security/user] and method [GET], allowed: [POST]';

describe('SecurityUnavailable', () => {
	it('gives each cause its own heading', () => {
		const headings = [CAUSE.SECURITY_DISABLED, CAUSE.PRIVILEGE, CAUSE.LICENSE].map(cause => {
			const { unmount } = render(SecurityUnavailable, { props: { cause } });
			const text = document.querySelector('.ui.header').textContent;
			unmount();
			return text;
		});

		expect(new Set(headings).size).toBe(3);
		expect(headings[0]).toMatch(/not enabled/i);
		expect(headings[1]).toMatch(/account/i);
		expect(headings[2]).toMatch(/licence/i);
	});

	it('explains a licence refusal in terms of the licence, not permissions', () => {
		render(SecurityUnavailable, { props: { cause: CAUSE.LICENSE } });

		expect(screen.getByText(/Platinum or Enterprise/)).toBeTruthy();
		expect(document.body.textContent).not.toMatch(/privilege/i);
	});

	it('names the privileges involved for a permission refusal', () => {
		render(SecurityUnavailable, { props: { cause: CAUSE.PRIVILEGE, entity: 'roles' } });

		expect(screen.getByText(/manage_security/)).toBeTruthy();
		expect(screen.getByText(/roles/)).toBeTruthy();
	});

	it('never shows the cluster wording as the message', async () => {
		render(SecurityUnavailable, {
			props: { cause: CAUSE.SECURITY_DISABLED, reason: MISLEADING },
		});

		expect(document.querySelector('.security-unavailable p').textContent).not.toContain('Incorrect HTTP method');
		expect(screen.queryByText(MISLEADING)).toBeNull();
	});

	it('offers the cluster wording as detail behind a toggle', async () => {
		render(SecurityUnavailable, {
			props: { cause: CAUSE.SECURITY_DISABLED, reason: MISLEADING },
		});

		await fireEvent.click(screen.getByText(/Show what the cluster reported/));
		expect(screen.getByText(MISLEADING)).toBeTruthy();
	});

	it('shows no toggle when the cluster said nothing useful', () => {
		render(SecurityUnavailable, { props: { cause: CAUSE.UNKNOWN } });
		expect(screen.queryByText(/what the cluster reported/)).toBeNull();
	});
});
