import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createStoreon } from 'storeon';
import { connections } from './connections';

vi.mock('../utils/storage', () => ({
	setStorage: vi.fn(),
	getStorage: vi.fn(),
}));

describe('connections store module', () => {
	let store;

	const conn1 = { name: 'Local', host: 'localhost', port: '9200' };
	const conn2 = { name: 'Remote', host: 'remote.host', port: '9200' };

	const expectedConn = (conn) => ({
		name: '',
		host: '',
		port: '',
		useAuth: false,
		user: '',
		password: '',
		addHeaders: false,
		headers: [],
		useSshTunnel: false,
		ssh: {
			host: '',
			port: '22',
			username: '',
			authMethod: 'password',
			password: '',
			privateKeyContent: '',
			privateKeyName: '',
			passphrase: '',
		},
		color: '',
		...conn
	});

	beforeEach(() => {
		store = createStoreon([connections]);
	});

	it('initializes with an empty connection list', () => {
		expect(store.get().connections.connection).toEqual([]);
	});

	it('hydrates connections state', () => {
		store.dispatch('connections/hydrate', { connection: [conn1] });
		expect(store.get().connections.connection).toEqual([expectedConn(conn1)]);
	});

	it('adds a connection', () => {
		store.dispatch('connections/add', conn1);
		expect(store.get().connections.connection).toEqual([expectedConn(conn1)]);
	});

	it('prevents duplicate connections', () => {
		store.dispatch('connections/add', conn1);
		store.dispatch('connections/add', conn1);
		expect(store.get().connections.connection).toHaveLength(1);
	});

	it('keeps every connection saved, with no upper limit', () => {
		for (let i = 0; i < 12; i++) {
			store.dispatch('connections/add', {
				name: `Server ${i}`,
				host: `host${i}`,
				port: '9200',
			});
		}
		expect(store.get().connections.connection).toHaveLength(12);
		// Nothing was evicted — the first one saved is still first
		expect(store.get().connections.connection[0].name).toBe('Server 0');
	});

	it('deletes a connection', () => {
		store.dispatch('connections/add', conn1);
		store.dispatch('connections/add', conn2);
		store.dispatch('connections/delete', conn1);
		expect(store.get().connections.connection).toEqual([expectedConn(conn2)]);
	});

	it('replaces a connection in place without reordering', () => {
		store.dispatch('connections/add', conn1);
		store.dispatch('connections/add', conn2);
		store.dispatch('connections/replace', {
			index: 0,
			connection: { ...conn1, name: 'Renamed' },
		});
		const stored = store.get().connections.connection;
		expect(stored).toHaveLength(2);
		expect(stored[0].name).toBe('Renamed');
		expect(stored[1]).toEqual(expectedConn(conn2));
	});

	it('normalizes the connection it replaces', () => {
		store.dispatch('connections/add', conn1);
		store.dispatch('connections/replace', {
			index: 0,
			connection: { name: 'Bare', host: 'bare-host', port: '9200', version: '8.12.0' },
		});
		const stored = store.get().connections.connection[0];
		expect(stored.version).toBeUndefined();
		expect(stored.ssh.port).toBe('22');
	});

	it('replace is a no-op for an out-of-range index', () => {
		store.dispatch('connections/add', conn1);
		store.dispatch('connections/replace', { index: 5, connection: conn2 });
		store.dispatch('connections/replace', { index: -1, connection: conn2 });
		expect(store.get().connections.connection).toEqual([expectedConn(conn1)]);
	});

	it('deletes only one entry when two are identical', () => {
		// replace can leave two entries deep-equal; deleting one must not take
		// the other with it.
		store.dispatch('connections/add', conn1);
		store.dispatch('connections/add', conn2);
		store.dispatch('connections/replace', { index: 1, connection: conn1 });
		expect(store.get().connections.connection).toHaveLength(2);

		store.dispatch('connections/delete', conn1);

		expect(store.get().connections.connection).toEqual([expectedConn(conn1)]);
	});

	it('delete is a no-op for non-existent connection', () => {
		store.dispatch('connections/add', conn1);
		store.dispatch('connections/delete', conn2);
		expect(store.get().connections.connection).toHaveLength(1);
	});

	it('clears all connections', () => {
		store.dispatch('connections/add', conn1);
		store.dispatch('connections/add', conn2);
		store.dispatch('connections/clear');
		expect(store.get().connections.connection).toEqual([]);
	});

	it('deduplicates connections when one has metadata like version', () => {
		const connWithVersion = { ...conn1, version: '8.12.0' };
		store.dispatch('connections/add', conn1);
		store.dispatch('connections/add', connWithVersion);
		expect(store.get().connections.connection).toHaveLength(1);
		// It should NOT have the version in the saved list
		expect(store.get().connections.connection[0].version).toBeUndefined();
	});

	it('deduplicates when both have metadata but are otherwise same', () => {
		const connV1 = { ...conn1, version: '7.10.0' };
		const connV2 = { ...conn1, version: '8.12.0' };
		store.dispatch('connections/add', connV1);
		store.dispatch('connections/add', connV2);
		expect(store.get().connections.connection).toHaveLength(1);
	});

	it('adds SSH defaults to old connections without SSH fields', () => {
		const oldConn = { name: 'Old', host: 'old-host', port: '9200' };
		store.dispatch('connections/add', oldConn);
		const stored = store.get().connections.connection[0];
		expect(stored.useSshTunnel).toBe(false);
		expect(stored.ssh).toBeDefined();
		expect(stored.ssh.host).toBe('');
		expect(stored.ssh.port).toBe('22');
		expect(stored.ssh.authMethod).toBe('password');
	});

	it('defaults connections saved before colors existed to no color', () => {
		const oldConn = { name: 'Old', host: 'old-host', port: '9200' };
		store.dispatch('connections/add', oldConn);
		expect(store.get().connections.connection[0].color).toBe('');
	});

	it('does not duplicate a stored connection that predates colors', () => {
		// What an existing user has on disk, hydrated on first launch after the
		// upgrade, then re-added by connection/save on connect.
		const stored = {
			name: 'Local',
			host: 'localhost',
			port: '9200',
			useAuth: false,
			user: '',
			password: '',
			addHeaders: false,
			headers: [],
			useSshTunnel: false,
			ssh: {
				host: '',
				port: '22',
				username: '',
				authMethod: 'password',
				password: '',
				privateKeyContent: '',
				privateKeyName: '',
				passphrase: '',
			},
		};
		store.dispatch('connections/hydrate', { connection: [stored] });
		store.dispatch('connections/add', { ...stored, version: '8.12.0' });
		expect(store.get().connections.connection).toHaveLength(1);
	});

	it('preserves a color through hydrate and re-add', () => {
		const colored = { ...conn1, color: '#db2828' };
		store.dispatch('connections/hydrate', { connection: [colored] });
		store.dispatch('connections/add', colored);
		expect(store.get().connections.connection).toHaveLength(1);
		expect(store.get().connections.connection[0].color).toBe('#db2828');
	});

	it('preserves SSH fields on connections that have them', () => {
		const sshConn = {
			name: 'SSH',
			host: 'es-host',
			port: '9200',
			useSshTunnel: true,
			ssh: {
				host: 'bastion.example.com',
				port: '2222',
				username: 'deploy',
				authMethod: 'privateKey',
				password: '',
				privateKeyContent: 'key-content',
				privateKeyName: 'id_rsa',
				passphrase: '',
			},
		};
		store.dispatch('connections/add', sshConn);
		const stored = store.get().connections.connection[0];
		expect(stored.useSshTunnel).toBe(true);
		expect(stored.ssh.host).toBe('bastion.example.com');
		expect(stored.ssh.port).toBe('2222');
		expect(stored.ssh.username).toBe('deploy');
		expect(stored.ssh.authMethod).toBe('privateKey');
		expect(stored.ssh.privateKeyContent).toBe('key-content');
	});
});
