import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createStoreon } from 'storeon';
import { connection, initialConnection, initialSshConfig } from './connection';

// Mock API and storage
vi.mock('../api/elasticsearch', () => ({
	default: vi.fn(),
	openTunnel: vi.fn(),
	closeTunnel: vi.fn(),
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

	it('initialConnection includes SSH tunnel defaults', () => {
		expect(initialConnection.useSshTunnel).toBe(false);
		expect(initialConnection.ssh).toBeDefined();
		expect(initialConnection.ssh.host).toBe('');
		expect(initialConnection.ssh.port).toBe('22');
		expect(initialConnection.ssh.username).toBe('');
		expect(initialConnection.ssh.authMethod).toBe('password');
		expect(initialConnection.ssh.password).toBe('');
		expect(initialConnection.ssh.privateKeyContent).toBe('');
		expect(initialConnection.ssh.privateKeyName).toBe('');
		expect(initialConnection.ssh.passphrase).toBe('');
	});

	it('initialSshConfig has correct defaults', () => {
		expect(initialSshConfig.port).toBe('22');
		expect(initialSshConfig.authMethod).toBe('password');
	});

	it('clears SSH tunnel fields on connection/clear', () => {
		store.dispatch('connection/hydrate', {
			useSshTunnel: true,
			ssh: { host: 'bastion', port: '2222', username: 'deploy', authMethod: 'password', password: 'secret', privateKeyContent: '', privateKeyName: '', passphrase: '' },
		});
		store.dispatch('connection/clear');
		const state = store.get().connection;
		expect(state.useSshTunnel).toBe(false);
		expect(state.ssh.host).toBe('');
		expect(state.ssh.port).toBe('22');
		expect(state.ssh.username).toBe('');
	});
});
