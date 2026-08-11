// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/svelte';
import { tick } from 'svelte';
import JsonEditor from './JsonEditor.svelte';
import { writable } from 'svelte/store';

vi.mock('@storeon/svelte', () => ({
	useStoreon: () => ({
		app: writable({ theme: 'light' })
	})
}));

const instances = [];

vi.mock('jsoneditor', () => {
	class FakeEditor {
		constructor(container, options) {
			this.container = container;
			this.options = options;
			this.content = undefined;
			this.invalidText = false;
			this.update = vi.fn(json => {
				this.content = json;
				this.invalidText = false;
			});
			this.destroy = vi.fn();
			instances.push(this);
		}

		get() {
			if (this.invalidText) throw new SyntaxError('Unexpected end of JSON input');
			return this.content;
		}
	}

	return { default: FakeEditor };
});

const renderEditor = async props => {
	instances.length = 0;
	const result = render(JsonEditor, props);
	// onMount dynamically imports jsoneditor, so wait for the editor to appear.
	for (let i = 0; i < 20 && instances.length === 0; i++) await tick();
	await tick();
	return { ...result, editor: instances[0] };
};

describe('JsonEditor', () => {
	it('mounts without crashing', async () => {
		const { container } = await renderEditor({ value: { test: true }, id: 'test-editor' });
		// JsonEditor uses a 3rd party wrapper. We just ensure it mounts its container.
		expect(container.querySelector('#test-editor')).toBeTruthy();
	});

	it('does not push back a value the editor already holds', async () => {
		const { rerender, editor } = await renderEditor({ value: { a: 1 }, id: 'no-clobber' });
		editor.update.mockClear();

		// A new object with the same contents — e.g. the parent re-parsed the text
		// the user just typed. Re-applying it would reformat and reset the cursor.
		await rerender({ value: { a: 1 }, id: 'no-clobber' });

		expect(editor.update).not.toHaveBeenCalled();
	});

	it('applies genuinely new values', async () => {
		const { rerender, editor } = await renderEditor({ value: { a: 1 }, id: 'applies-new' });
		editor.update.mockClear();

		await rerender({ value: { a: 2 }, id: 'applies-new' });
		await tick();

		expect(editor.update).toHaveBeenCalledWith({ a: 2 });
	});

	it('applies external values while the editor holds invalid JSON', async () => {
		const { rerender, editor } = await renderEditor({ value: { a: 1 }, id: 'invalid-text' });
		editor.update.mockClear();
		editor.invalidText = true;

		await rerender({ value: { b: 2 }, id: 'invalid-text' });
		await tick();

		expect(editor.update).toHaveBeenCalledWith({ b: 2 });
	});
});
