import { describe, it, expect, beforeEach } from 'vitest';
import { createStoreon } from 'storeon';
import { server } from './server';

describe('server store module', () => {
	let store;

	beforeEach(() => {
		store = createStoreon([server]);
	});

	it('initializes without a version', () => {
		expect(store.get().server.version).toBe(null);
	});

	it('stores a version number string as-is', () => {
		store.dispatch('server/update', { version: '8.12.0' });
		expect(store.get().server.version).toBe('8.12.0');
	});

	it('unwraps the raw elasticsearch version object', () => {
		store.dispatch('server/update', {
			version: { number: '8.12.0', build_flavor: 'default' },
		});
		expect(store.get().server.version).toBe('8.12.0');
	});

	it('keeps the version when updating other fields', () => {
		store.dispatch('server/update', { version: '8.12.0' });
		store.dispatch('server/update', { cluster: 'test' });
		expect(store.get().server.version).toBe('8.12.0');
	});
});
