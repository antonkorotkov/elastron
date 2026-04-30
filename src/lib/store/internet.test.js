import { describe, it, expect, beforeEach } from 'vitest';
import { createStoreon } from 'storeon';
import { internet } from './internet';

describe('internet store module', () => {
	let store;

	beforeEach(() => {
		store = createStoreon([internet]);
	});

	it('initializes as offline', () => {
		expect(store.get().internet.online).toBe(false);
	});

	it('sets online', () => {
		store.dispatch('internet/online');
		expect(store.get().internet.online).toBe(true);
	});

	it('sets offline', () => {
		store.dispatch('internet/online');
		store.dispatch('internet/offline');
		expect(store.get().internet.online).toBe(false);
	});
});
