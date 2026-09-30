// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/svelte';
import { writable } from 'svelte/store';

vi.mock('@storeon/svelte', () => ({ useStoreon: () => ({ app: writable({ theme: 'dark' }) }) }));

// Svelte's fly/fade transitions call element.animate, which jsdom does not
// implement. The layout shape is what matters here, so it is stubbed out.
Element.prototype.animate ??= () => ({
	cancel() {},
	finish() {},
	addEventListener() {},
	removeEventListener() {},
});

import Modal from './Modal.svelte';
import Dialog from './__TestDialog.svelte';

/**
 * The rules that keep a tall dialog usable are written against a specific
 * shape: `.ui.page.modals.dimmer > .ui.modal > .content`. If Modal.svelte's
 * markup drifts, those selectors stop matching and the dialog silently goes
 * back to being cut off. Rendering the real shell proves they still match.
 */
const openModal = () => {
	let opener;
	render(Modal, {
		props: {
			setContext: (_key, api) => {
				opener = api;
			},
			children: () => {},
		},
	});
	opener.open(Dialog, {});
	return opener;
};

describe('the modal shell the layout rules target', () => {
	it('renders a dimmer carrying every class the rules select on', async () => {
		openModal();
		await new Promise(r => setTimeout(r, 0));

		const dimmer = document.querySelector('.ui.page.modals.dimmer');
		expect(dimmer).toBeTruthy();
	});

	it('puts the modal as a direct child of that dimmer', async () => {
		openModal();
		await new Promise(r => setTimeout(r, 0));

		expect(document.querySelector('.ui.page.modals.dimmer > .ui.modal')).toBeTruthy();
	});

	it('puts header, content and actions as direct children of the modal', async () => {
		openModal();
		await new Promise(r => setTimeout(r, 0));

		const base = '.ui.page.modals.dimmer > .ui.modal > ';
		expect(document.querySelector(`${base}.header`)).toBeTruthy();
		expect(document.querySelector(`${base}.content`)).toBeTruthy();
		expect(document.querySelector(`${base}.actions`)).toBeTruthy();
	});

	it('marks the modal inverted in dark mode, which the dark rules select on', async () => {
		openModal();
		await new Promise(r => setTimeout(r, 0));

		expect(document.querySelector('.ui.modal.inverted')).toBeTruthy();
	});
});
