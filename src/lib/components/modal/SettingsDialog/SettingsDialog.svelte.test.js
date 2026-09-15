// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import { writable } from 'svelte/store';
import SettingsDialog from './SettingsDialog.svelte';
import StubAlpha from './test-fixtures/StubAlpha.svelte';
import StubBeta from './test-fixtures/StubBeta.svelte';

const close = vi.hoisted(() => vi.fn());

vi.mock('@storeon/svelte', () => ({
	useStoreon: () => ({ app: writable({ theme: 'light' }), dispatch: vi.fn() }),
}));

vi.mock('svelte', async importOriginal => ({
	...(await importOriginal()),
	getContext: () => ({ close }),
}));

const sections = [
	{ id: 'alpha', title: 'Alpha', component: StubAlpha },
	{ id: 'beta', title: 'Beta', component: StubBeta },
];

const panel = id => document.getElementById(`settings-panel-${id}`);

describe('SettingsDialog', () => {
	beforeEach(() => close.mockClear());

	it('lists every section as a vertical tab', () => {
		render(SettingsDialog, { sections });
		const tabs = screen.getAllByRole('tab');
		expect(tabs.map(tab => tab.textContent.trim())).toEqual(['Alpha', 'Beta']);
		expect(screen.getByRole('tablist').getAttribute('aria-orientation')).toBe('vertical');
	});

	it('shows the first section only', () => {
		render(SettingsDialog, { sections });
		expect(panel('alpha').hidden).toBe(false);
		expect(panel('beta').hidden).toBe(true);
		expect(screen.getByRole('tab', { name: 'Alpha' }).getAttribute('aria-selected')).toBe('true');
	});

	it('opens on the requested section', () => {
		render(SettingsDialog, { sections, initialSection: 'beta' });
		expect(panel('beta').hidden).toBe(false);
		expect(panel('alpha').hidden).toBe(true);
	});

	it('falls back to the first section for an unknown id', () => {
		render(SettingsDialog, { sections, initialSection: 'missing' });
		expect(panel('alpha').hidden).toBe(false);
	});

	it('switches sections without altering the other section', async () => {
		render(SettingsDialog, { sections });
		const alpha = screen.getByLabelText('Alpha value');
		await fireEvent.input(alpha, { target: { value: 'kept' } });

		await fireEvent.click(screen.getByRole('tab', { name: 'Beta' }));
		expect(panel('beta').hidden).toBe(false);
		expect(panel('alpha').hidden).toBe(true);

		await fireEvent.click(screen.getByRole('tab', { name: 'Alpha' }));
		expect(screen.getByLabelText('Alpha value').value).toBe('kept');
	});

	it('saves every section and closes on Save', async () => {
		globalThis.__savedSections = [];
		render(SettingsDialog, { sections });
		await fireEvent.click(screen.getByRole('button', { name: 'Save' }));
		expect(globalThis.__savedSections).toEqual(['alpha', 'beta']);
		expect(close).toHaveBeenCalled();
	});

	it('closes without saving on Cancel', async () => {
		globalThis.__savedSections = [];
		render(SettingsDialog, { sections });
		await fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
		expect(globalThis.__savedSections).toEqual([]);
		expect(close).toHaveBeenCalled();
	});

	it('uses the same footer buttons as the other dialogs', () => {
		render(SettingsDialog, { sections });
		expect(screen.getByRole('button', { name: 'Cancel' }).className).toContain('ui black deny button');
		expect(screen.getByRole('button', { name: 'Save' }).className).toContain('ui green right button');
	});
});
