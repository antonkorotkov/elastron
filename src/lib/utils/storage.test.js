import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getStorage, setStorage } from './storage';

describe('storage', () => {
	let originalWindow;

	beforeEach(() => {
		originalWindow = globalThis.window;
	});

	afterEach(() => {
		globalThis.window = originalWindow;
	});

	describe('getStorage', () => {
		it('returns the default value when window.electron is not available', async () => {
			globalThis.window = {};
			const result = await getStorage('key', 'default');
			expect(result).toBe('default');
		});

		it('returns the default value when window is undefined', async () => {
			globalThis.window = undefined;
			const result = await getStorage('key', 'fallback');
			expect(result).toBe('fallback');
		});

		it('calls ipcRenderer.store.get when available', async () => {
			const mockGet = vi.fn().mockResolvedValue('stored-value');
			globalThis.window = {
				electron: {
					ipcRenderer: {
						store: { get: mockGet },
					},
				},
			};
			const result = await getStorage('myKey', 'default');
			expect(mockGet).toHaveBeenCalledWith('myKey', 'default');
			expect(result).toBe('stored-value');
		});
	});

	describe('setStorage', () => {
		it('does nothing when window.electron is not available', () => {
			globalThis.window = {};
			expect(() => setStorage('key', 'value')).not.toThrow();
		});

		it('calls ipcRenderer.store.set when available', () => {
			const mockSet = vi.fn();
			globalThis.window = {
				electron: {
					ipcRenderer: {
						store: { set: mockSet },
					},
				},
			};
			setStorage('myKey', 'myValue');
			expect(mockSet).toHaveBeenCalledWith('myKey', 'myValue');
		});
	});
});
