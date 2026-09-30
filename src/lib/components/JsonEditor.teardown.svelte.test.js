// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/svelte';
import { tick } from 'svelte';

/**
 * jsoneditor nulls its internals while tearing down, and a change event that
 * lands during that throws from deep inside it, typically
 * "this._debouncedValidate is not a function". Every consumer of this wrapper
 * shows `onError` to the user, and the two security dialogs also gate saving
 * on it, so a teardown failure used to surface as though the user's JSON were
 * at fault and left Save disabled.
 */
const instance = vi.hoisted(() => ({ destroy: null, update: null, get: null, construct: null }));

vi.mock('jsoneditor', () => ({
	default: class {
		constructor(...args) {
			if (instance.construct) instance.construct(...args);
		}
		destroy(...args) {
			return instance.destroy(...args);
		}
		update(...args) {
			return instance.update(...args);
		}
		get(...args) {
			return instance.get(...args);
		}
	},
}));

import JsonEditor from './JsonEditor.svelte';

beforeEach(() => {
	instance.destroy = vi.fn();
	instance.update = vi.fn();
	instance.get = vi.fn(() => ({}));
	instance.construct = null;
	vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
	vi.restoreAllMocks();
});

// The wrapper imports jsoneditor dynamically inside onMount, so the editor
// only exists after a macrotask, not merely after a tick.
const mount = async (props = {}) => {
	const result = render(JsonEditor, { props: { value: { a: 1 }, onError: props.onError ?? vi.fn(), ...props } });
	await new Promise(resolve => setTimeout(resolve, 0));
	await tick();
	return result;
};

describe('JsonEditor teardown', () => {
	it('does not report a failed teardown to the caller', async () => {
		const onError = vi.fn();
		instance.destroy = vi.fn(() => {
			throw new TypeError('this._debouncedValidate is not a function');
		});

		const { unmount } = await mount({ onError });
		onError.mockClear();
		unmount();

		expect(onError).not.toHaveBeenCalled();
	});

	it('records the failure where a developer can still find it', async () => {
		instance.destroy = vi.fn(() => {
			throw new TypeError('this._debouncedValidate is not a function');
		});

		const { unmount } = await mount();
		unmount();

		expect(console.warn).toHaveBeenCalledWith(
			expect.stringContaining('tear down'),
			expect.any(TypeError)
		);
	});

	it('still reports a failure to create the editor, since there is then nothing to edit', async () => {
		const onError = vi.fn();
		instance.construct = vi.fn(() => {
			throw new Error('editor failed to load');
		});

		await mount({ onError });

		expect(onError).toHaveBeenCalledWith(
			expect.objectContaining({ message: 'editor failed to load' })
		);
	});

	it('does not report a value the editor rejects, which the user did not type', async () => {
		const onError = vi.fn();
		instance.update = vi.fn(() => {
			throw new Error('bad value');
		});

		await mount({ onError });

		expect(onError).not.toHaveBeenCalled();
		expect(console.warn).toHaveBeenCalledWith(
			expect.stringContaining('could not take the value'),
			expect.any(Error)
		);
	});

	it('never touches the editor again once it has been torn down', async () => {
		const onError = vi.fn();
		const { unmount, rerender } = await mount({ onError });

		unmount();
		instance.update.mockClear();
		await rerender({ value: { a: 2 }, onError }).catch(() => {});
		await tick();

		expect(instance.update).not.toHaveBeenCalled();
		expect(onError).not.toHaveBeenCalled();
	});
});

describe('switching a dialog between form and JSON views', () => {
	// Both messages the user saw come from calling into an editor that has
	// already been torn down: tree mode nulls `node`, code mode nulls
	// `_debouncedValidate`. Neither is the user's doing.
	it.each([
		['code mode', new TypeError('this._debouncedValidate is not a function')],
		['tree mode', new TypeError("Cannot read properties of null (reading 'deepEqual')")],
	])('does not show the %s teardown error when a value arrives late', async (_label, thrown) => {
		const onError = vi.fn();
		const { unmount, rerender } = await mount({ onError });

		instance.update = vi.fn(() => {
			throw thrown;
		});
		unmount();
		await rerender({ value: { a: 2 }, onError }).catch(() => {});
		await tick();

		expect(onError).not.toHaveBeenCalled();
	});

	it('reports nothing to the caller when the editor rejects a value', async () => {
		const onError = vi.fn();
		await mount({ onError });
		onError.mockClear();

		instance.update = vi.fn(() => {
			throw new TypeError('this._debouncedValidate is not a function');
		});
		await tick();

		expect(onError).not.toHaveBeenCalled();
	});

	it('clears the binding so the caller cannot use a torn-down editor', async () => {
		let held = null;
		const { unmount } = render(JsonEditor, {
			props: {
				value: { a: 1 },
				onError: vi.fn(),
				get editor() {
					return held;
				},
				set editor(next) {
					held = next;
				},
			},
		});
		await new Promise(resolve => setTimeout(resolve, 0));
		expect(held).not.toBeNull();

		unmount();
		expect(held).toBeNull();
	});

	it('creates no editor when the component is gone before the import lands', async () => {
		let created = 0;
		instance.update = vi.fn(() => {
			created += 1;
		});

		const { unmount } = render(JsonEditor, { props: { value: { a: 1 }, onError: vi.fn() } });
		unmount();
		await new Promise(resolve => setTimeout(resolve, 0));

		expect(created).toBe(0);
		expect(instance.destroy).not.toHaveBeenCalled();
	});
});
