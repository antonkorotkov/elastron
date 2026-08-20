import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createStoreon } from 'storeon';
import { history } from './history';

vi.mock('../utils/storage', () => ({
	setStorage: vi.fn(),
	getStorage: vi.fn(),
}));

describe('history store module', () => {
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
		store = createStoreon([history]);
	});

	it('initializes with empty connection history', () => {
		expect(store.get().history.connection).toEqual([]);
	});

	it('hydrates history state', () => {
		store.dispatch('history/hydrate', { connection: [conn1] });
		expect(store.get().history.connection).toEqual([expectedConn(conn1)]);
	});

	it('adds a connection to history', () => {
		store.dispatch('history/connection/add', conn1);
		expect(store.get().history.connection).toEqual([expectedConn(conn1)]);
	});

	it('prevents duplicate connections', () => {
		store.dispatch('history/connection/add', conn1);
		store.dispatch('history/connection/add', conn1);
		expect(store.get().history.connection).toHaveLength(1);
	});

	it('caps history at 10 entries', () => {
		for (let i = 0; i < 12; i++) {
			store.dispatch('history/connection/add', {
				name: `Server ${i}`,
				host: `host${i}`,
				port: '9200',
			});
		}
		expect(store.get().history.connection).toHaveLength(10);
		// The first two should have been shifted out
		expect(store.get().history.connection[0].name).toBe('Server 2');
	});

	it('deletes a connection from history', () => {
		store.dispatch('history/connection/add', conn1);
		store.dispatch('history/connection/add', conn2);
		store.dispatch('history/connection/delete', conn1);
		expect(store.get().history.connection).toEqual([expectedConn(conn2)]);
	});

	it('replaces a connection in place without reordering', () => {
		store.dispatch('history/connection/add', conn1);
		store.dispatch('history/connection/add', conn2);
		store.dispatch('history/connection/replace', {
			index: 0,
			connection: { ...conn1, name: 'Renamed' },
		});
		const stored = store.get().history.connection;
		expect(stored).toHaveLength(2);
		expect(stored[0].name).toBe('Renamed');
		expect(stored[1]).toEqual(expectedConn(conn2));
	});

	it('normalizes the connection it replaces', () => {
		store.dispatch('history/connection/add', conn1);
		store.dispatch('history/connection/replace', {
			index: 0,
			connection: { name: 'Bare', host: 'bare-host', port: '9200', version: '8.12.0' },
		});
		const stored = store.get().history.connection[0];
		expect(stored.version).toBeUndefined();
		expect(stored.ssh.port).toBe('22');
	});

	it('replace is a no-op for an out-of-range index', () => {
		store.dispatch('history/connection/add', conn1);
		store.dispatch('history/connection/replace', { index: 5, connection: conn2 });
		store.dispatch('history/connection/replace', { index: -1, connection: conn2 });
		expect(store.get().history.connection).toEqual([expectedConn(conn1)]);
	});

	it('deletes only one entry when two are identical', () => {
		// replace can leave two entries deep-equal; deleting one must not take
		// the other with it.
		store.dispatch('history/connection/add', conn1);
		store.dispatch('history/connection/add', conn2);
		store.dispatch('history/connection/replace', { index: 1, connection: conn1 });
		expect(store.get().history.connection).toHaveLength(2);

		store.dispatch('history/connection/delete', conn1);

		expect(store.get().history.connection).toEqual([expectedConn(conn1)]);
	});

	it('delete is a no-op for non-existent connection', () => {
		store.dispatch('history/connection/add', conn1);
		store.dispatch('history/connection/delete', conn2);
		expect(store.get().history.connection).toHaveLength(1);
	});

	it('clears all connections', () => {
		store.dispatch('history/connection/add', conn1);
		store.dispatch('history/connection/add', conn2);
		store.dispatch('history/connection/clear');
		expect(store.get().history.connection).toEqual([]);
	});

	it('deduplicates connections when one has metadata like version', () => {
		const connWithVersion = { ...conn1, version: '8.12.0' };
		store.dispatch('history/connection/add', conn1);
		store.dispatch('history/connection/add', connWithVersion);
		expect(store.get().history.connection).toHaveLength(1);
		// It should NOT have the version in history
		expect(store.get().history.connection[0].version).toBeUndefined();
	});

	it('deduplicates when both have metadata but are otherwise same', () => {
		const connV1 = { ...conn1, version: '7.10.0' };
		const connV2 = { ...conn1, version: '8.12.0' };
		store.dispatch('history/connection/add', connV1);
		store.dispatch('history/connection/add', connV2);
		expect(store.get().history.connection).toHaveLength(1);
	});

	it('adds SSH defaults to old connections without SSH fields', () => {
		const oldConn = { name: 'Old', host: 'old-host', port: '9200' };
		store.dispatch('history/connection/add', oldConn);
		const stored = store.get().history.connection[0];
		expect(stored.useSshTunnel).toBe(false);
		expect(stored.ssh).toBeDefined();
		expect(stored.ssh.host).toBe('');
		expect(stored.ssh.port).toBe('22');
		expect(stored.ssh.authMethod).toBe('password');
	});

	it('defaults connections saved before colors existed to no color', () => {
		const oldConn = { name: 'Old', host: 'old-host', port: '9200' };
		store.dispatch('history/connection/add', oldConn);
		expect(store.get().history.connection[0].color).toBe('');
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
		store.dispatch('history/hydrate', { connection: [stored] });
		store.dispatch('history/connection/add', { ...stored, version: '8.12.0' });
		expect(store.get().history.connection).toHaveLength(1);
	});

	it('preserves a color through hydrate and re-add', () => {
		const colored = { ...conn1, color: '#db2828' };
		store.dispatch('history/hydrate', { connection: [colored] });
		store.dispatch('history/connection/add', colored);
		expect(store.get().history.connection).toHaveLength(1);
		expect(store.get().history.connection[0].color).toBe('#db2828');
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
		store.dispatch('history/connection/add', sshConn);
		const stored = store.get().history.connection[0];
		expect(stored.useSshTunnel).toBe(true);
		expect(stored.ssh.host).toBe('bastion.example.com');
		expect(stored.ssh.port).toBe('2222');
		expect(stored.ssh.username).toBe('deploy');
		expect(stored.ssh.authMethod).toBe('privateKey');
		expect(stored.ssh.privateKeyContent).toBe('key-content');
	});
});
