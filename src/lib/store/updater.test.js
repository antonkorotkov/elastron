import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createStoreon } from 'storeon';
import { updater } from './updater';

describe('updater store module', () => {
	let originalWindow;

	beforeEach(() => {
		originalWindow = globalThis.window;
	});

	afterEach(() => {
		globalThis.window = originalWindow;
	});

	it('initializes with idle state', () => {
		globalThis.window = undefined;
		const store = createStoreon([updater]);
		expect(store.get().updater).toEqual({
			downloading: false,
			percent: 0,
			downloaded: false,
		});
	});

	it('registers ipcRenderer listeners on init when window.electron is available', () => {
		const handlers = {};
		globalThis.window = {
			electron: {
				ipcRenderer: {
					on: vi.fn((channel, func) => {
						handlers[channel] = func;
					}),
					send: vi.fn(),
				},
			},
		};

		const store = createStoreon([updater]);

		expect(window.electron.ipcRenderer.on).toHaveBeenCalledWith('update_available', expect.any(Function));
		expect(window.electron.ipcRenderer.on).toHaveBeenCalledWith('update-download-progress', expect.any(Function));
		expect(window.electron.ipcRenderer.on).toHaveBeenCalledWith('update_downloaded', expect.any(Function));

		handlers['update_available']();
		expect(store.get().updater.downloading).toBe(true);

		handlers['update-download-progress']({ percent: 42 });
		expect(store.get().updater.percent).toBe(42);

		handlers['update_downloaded']();
		expect(store.get().updater.downloading).toBe(false);
		expect(store.get().updater.downloaded).toBe(true);
	});

	it('transitions through download start, progress, and complete', () => {
		globalThis.window = undefined;
		const store = createStoreon([updater]);

		store.dispatch('updater/download-start');
		expect(store.get().updater).toMatchObject({ downloading: true, percent: 0 });

		store.dispatch('updater/download-progress', 55);
		expect(store.get().updater.percent).toBe(55);

		store.dispatch('updater/download-complete');
		expect(store.get().updater).toMatchObject({ downloading: false, downloaded: true });
	});

	it('sends restart-and-install when restarting', () => {
		const mockSend = vi.fn();
		globalThis.window = {
			electron: {
				ipcRenderer: { on: vi.fn(), send: mockSend },
			},
		};
		const store = createStoreon([updater]);

		store.dispatch('updater/restart')
		expect(mockSend).toHaveBeenCalledWith('restart-and-install');
	});

	it('does nothing when restarting without window.electron', () => {
		globalThis.window = undefined;
		const store = createStoreon([updater]);
		expect(() => store.dispatch('updater/restart')).not.toThrow();
	});
});
