// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/svelte';
import JsonEditor from './JsonEditor.svelte';
import { writable } from 'svelte/store';

vi.mock('@storeon/svelte', () => ({
	useStoreon: () => ({
		app: writable({ theme: 'light' })
	})
}));

describe('JsonEditor', () => {
	it('mounts without crashing', () => {
		const { container } = render(JsonEditor, { value: { test: true }, id: 'test-editor' });
		// JsonEditor uses a 3rd party wrapper. We just ensure it mounts its container.
		expect(container.querySelector('#test-editor')).toBeTruthy();
	});
});
