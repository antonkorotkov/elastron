import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createStoreon } from 'storeon';
import { connection, initialConnection } from './connection';

// Mock API and storage
vi.mock('../api/elasticsearch', () => ({
	default: vi.fn(),
}));
vi.mock('../utils/storage', () => ({
	setStorage: vi.fn(),
	getStorage: vi.fn(),
}));

describe('connection store module', () => {
	let store;

	beforeEach(() => {
		store = createStoreon([connection]);
	});

	it('initializes with the default connection', () => {
		const state = store.get().connection;
		expect(state.name).toBe('Local Server');
		expect(state.host).toBe('https://localhost');
		expect(state.port).toBe('9200');
		expect(state.useAuth).toBe(false);
	});

	it('hydrates connection state', () => {
		store.dispatch('connection/hydrate', {
			name: 'Production',
			host: 'https://prod.example.com',
		});
		const state = store.get().connection;
		expect(state.name).toBe('Production');
		expect(state.host).toBe('https://prod.example.com');
		// Other fields should remain from initial
		expect(state.port).toBe('9200');
	});

	it('updates connection state', () => {
		store.dispatch('connection/update', { port: '9243' });
		expect(store.get().connection.port).toBe('9243');
	});

	it('clears connection to empty values', () => {
		store.dispatch('connection/hydrate', {
			name: 'Test',
			host: 'some-host',
		});
		store.dispatch('connection/clear');
		const state = store.get().connection;
		expect(state.name).toBe('');
		expect(state.host).toBe('');
		expect(state.useAuth).toBe(false);
		expect(state.headers).toEqual([{ name: '', value: '' }]);
	});

	it('initialConnection matches documented defaults', () => {
		expect(initialConnection.name).toBe('Local Server');
		expect(initialConnection.addHeaders).toBe(false);
	});
});
