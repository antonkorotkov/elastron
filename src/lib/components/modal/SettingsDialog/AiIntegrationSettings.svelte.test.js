// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import { createStoreon } from 'storeon';
import { tick } from 'svelte';
import AiIntegrationSettings from './AiIntegrationSettings.svelte';
import { aiSettings } from '../../../store/aiSettings.js';
import { app } from '../../../store/app.js';

// Backs useStoreon with a real store so the form round-trips through the
// actual aiSettings module rather than a stub.
const holder = vi.hoisted(() => ({ store: null }));

vi.mock('@storeon/svelte', () => {
	const { readable } = require('svelte/store');
	return {
		useStoreon: (...keys) => {
			const { store } = holder;
			const result = { dispatch: store.dispatch };
			for (const key of keys) {
				result[key] = readable(store.get()[key], set => {
					set(store.get()[key]);
					return store.on('@changed', state => set(state[key]));
				});
			}
			return result;
		},
	};
});

const input = id => document.getElementById(id);
const type = async (id, value) => {
	await fireEvent.input(input(id), { target: { value } });
	await tick();
};

describe('AiIntegrationSettings', () => {
	let form;

	beforeEach(() => {
		holder.store = createStoreon([app, aiSettings]);
		holder.store.dispatch('aiSettings/hydrate', {
			activeProvider: 'anthropic',
			providers: { anthropic: { apiKey: 'sk-stored', model: 'claude-opus-5' } },
		});
		form = render(AiIntegrationSettings).component;
	});

	const settings = () => holder.store.get().aiSettings;

	it('starts from the saved settings', () => {
		expect(screen.getByLabelText('Active provider').value).toBe('anthropic');
		expect(input('ai-anthropic-api-key').value).toBe('sk-stored');
	});

	it('offers every provider plus none as the active provider', () => {
		const options = [...screen.getByLabelText('Active provider').options].map(o => o.textContent.trim());
		expect(options).toEqual(['None', 'OpenAI', 'Anthropic', 'Google Gemini', 'Custom (OpenAI-compatible)']);
	});

	it('keeps edits in the draft until saved', async () => {
		await type('ai-openai-api-key', 'sk-openai');
		await fireEvent.change(screen.getByLabelText('Active provider'), { target: { value: 'openai' } });
		expect(settings().activeProvider).toBe('anthropic');
		expect(settings().providers.openai.apiKey).toBe('');
	});

	it('saves every field of every provider', async () => {
		await type('ai-openai-api-key', 'sk-openai');
		await type('ai-openai-model', 'gpt-5.1');
		await type('ai-google-api-key', 'g-key');
		await type('ai-google-model', 'gemini-3-pro');
		await type('ai-custom-base-url', 'http://localhost:11434/v1');
		await type('ai-custom-api-key', 'local');
		await type('ai-custom-model', 'llama3.1');
		await fireEvent.change(screen.getByLabelText('Active provider'), { target: { value: 'custom' } });

		form.save();

		expect(settings()).toEqual({
			activeProvider: 'custom',
			providers: {
				openai: { apiKey: 'sk-openai', model: 'gpt-5.1' },
				anthropic: { apiKey: 'sk-stored', model: 'claude-opus-5' },
				google: { apiKey: 'g-key', model: 'gemini-3-pro' },
				custom: { apiKey: 'local', model: 'llama3.1', baseUrl: 'http://localhost:11434/v1' },
			},
		});
	});

	it('masks every API key', () => {
		for (const provider of ['openai', 'anthropic', 'google', 'custom']) {
			expect(input(`ai-${provider}-api-key`).type).toBe('password');
		}
	});

	it('shows the base URL field only for the custom provider', () => {
		expect(input('ai-custom-base-url')).toBeTruthy();
		expect(input('ai-openai-base-url')).toBeNull();
	});

	it('switches providers without losing typed values', async () => {
		await type('ai-openai-api-key', 'sk-openai');
		const select = screen.getByLabelText('Active provider');
		await fireEvent.change(select, { target: { value: 'openai' } });
		await fireEvent.change(select, { target: { value: 'anthropic' } });
		await tick();
		expect(input('ai-openai-api-key').value).toBe('sk-openai');
		expect(input('ai-anthropic-api-key').value).toBe('sk-stored');
	});

	it('marks the active provider in the draft', async () => {
		await fireEvent.change(screen.getByLabelText('Active provider'), { target: { value: 'google' } });
		await tick();
		const active = document.querySelector('.provider-header.active-provider');
		expect(active.textContent).toContain('Google Gemini');
	});

	it('saves None as no active provider', async () => {
		await fireEvent.change(screen.getByLabelText('Active provider'), { target: { value: '' } });
		form.save();
		expect(settings().activeProvider).toBe(null);
	});

	it('lightens the hint text in dark mode', async () => {
		const hint = document.querySelector('.hint');
		expect(hint.classList.contains('inverted')).toBe(false);
		holder.store.dispatch('app/toggleTheme', 'dark');
		await tick();
		expect(hint.classList.contains('inverted')).toBe(true);
	});
});
