// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import { createStoreon } from 'storeon';
import SettingsDialog from './SettingsDialog.svelte';
import { settingsSections } from './sections.js';
import { aiSettings } from '../../../store/aiSettings.js';
import { app } from '../../../store/app.js';

const holder = vi.hoisted(() => ({ store: null }));

vi.mock('@storeon/svelte', () => {
	const { readable } = require('svelte/store');
	return {
		useStoreon: (...keys) => {
			const { store } = holder;
			const result = { dispatch: store.dispatch };
			for (const key of keys) {
				result[key] = readable(store.get()[key], set =>
					store.on('@changed', state => set(state[key]))
				);
			}
			return result;
		},
	};
});

vi.mock('svelte', async importOriginal => ({
	...(await importOriginal()),
	getContext: () => ({ close: vi.fn() }),
}));

describe('registered settings sections', () => {
	beforeEach(() => {
		holder.store = createStoreon([app, aiSettings]);
	});

	it('registers AI Integration first', () => {
		expect(settingsSections[0].id).toBe('ai');
		expect(settingsSections[0].title).toBe('AI Integration');
	});

	it('renders AI Integration in the default dialog and selects it', async () => {
		render(SettingsDialog);
		const tab = screen.getByRole('tab', { name: 'AI Integration' });
		await fireEvent.click(tab);
		expect(tab.getAttribute('aria-selected')).toBe('true');
		expect(document.getElementById('settings-panel-ai').hidden).toBe(false);
		expect(screen.getByLabelText('Active provider')).toBeTruthy();
	});

	it('commits AI settings only when Save is pressed', async () => {
		render(SettingsDialog);
		await fireEvent.change(screen.getByLabelText('Active provider'), { target: { value: 'google' } });
		await fireEvent.input(document.getElementById('ai-google-api-key'), { target: { value: 'g-key' } });
		expect(holder.store.get().aiSettings.activeProvider).toBe(null);

		await fireEvent.click(screen.getByRole('button', { name: 'Save' }));
		expect(holder.store.get().aiSettings.activeProvider).toBe('google');
		expect(holder.store.get().aiSettings.providers.google.apiKey).toBe('g-key');
	});

	it('discards AI settings on Cancel', async () => {
		render(SettingsDialog);
		await fireEvent.input(document.getElementById('ai-openai-api-key'), { target: { value: 'sk-draft' } });
		await fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
		expect(holder.store.get().aiSettings.providers.openai.apiKey).toBe('');
	});

	it('opens straight to AI Integration when asked', () => {
		render(SettingsDialog, { initialSection: 'ai' });
		expect(document.getElementById('settings-panel-ai').hidden).toBe(false);
	});
});
