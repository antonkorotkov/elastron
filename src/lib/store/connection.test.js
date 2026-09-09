import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createStoreon } from 'storeon';
import { connection, initialConnection, initialSshConfig } from './connection';
import API from '../api/elasticsearch';

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

	describe('connection/save', () => {
		const save = () =>
			new Promise(resolve => store.dispatch('connection/save', resolve));

		const mockTest = result => {
			API.mockImplementation(function () {
				this.test = async () => result;
			});
		};

		it('stores the version number from the elasticsearch response', async () => {
			mockTest({ success: true, version: { number: '8.12.0' } });
			await save();
			expect(store.get().connection.version).toBe('8.12.0');
		});

		it('stores a null version when the server reports none', async () => {
			mockTest({ success: true });
			await save();
			expect(store.get().connection.version).toBe(null);
		});

		it('dispatches connected with the cluster version and build flavor', async () => {
			mockTest({ success: true, version: { number: '8.12.0', build_flavor: 'default' } });
			const connected = vi.fn();
			store.on('connected', (state, payload) => connected(payload));
			await save();
			expect(connected).toHaveBeenCalledTimes(1);
			expect(connected).toHaveBeenCalledWith({ version: '8.12.0', flavor: 'default' });
		});

		it('dispatches connected with an undefined flavor when the server omits it', async () => {
			mockTest({ success: true, version: { number: '8.12.0' } });
			const connected = vi.fn();
			store.on('connected', (state, payload) => connected(payload));
			await save();
			expect(connected).toHaveBeenCalledWith({ version: '8.12.0', flavor: undefined });
		});

		it('does not dispatch connected when the test fails', async () => {
			mockTest({ success: false });
			const connected = vi.fn();
			store.on('connected', connected);
			await save();
			expect(connected).not.toHaveBeenCalled();
		});
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
