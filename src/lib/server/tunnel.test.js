import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TunnelManager } from './tunnel';

// Mock ssh2
const mockForwardOut = vi.fn();
const mockSshEnd = vi.fn();
const mockSshConnect = vi.fn();
const mockSshOn = vi.fn();
const mockSshRemoveAllListeners = vi.fn();

vi.mock('ssh2', () => {
	return {
		Client: class MockSSHClient {
			constructor() {
				this.forwardOut = mockForwardOut;
				this.end = mockSshEnd;
				this.connect = mockSshConnect;
				this.on = mockSshOn;
				this.removeAllListeners = mockSshRemoveAllListeners;
			}
		}
	};
});

// Mock net
const mockServerListen = vi.fn();
const mockServerClose = vi.fn();
const mockServerOn = vi.fn();

vi.mock('net', () => {
	return {
		default: {
			createServer: vi.fn(() => ({
				listen: mockServerListen,
				close: mockServerClose,
				on: mockServerOn,
			})),
		}
	};
});

// Mock get-port
vi.mock('get-port', () => ({
	default: vi.fn().mockResolvedValue(54321),
}));

describe('TunnelManager', () => {
	let manager;

	const sshConfig = {
		host: 'bastion.example.com',
		port: '22',
		username: 'deploy',
		authMethod: 'password',
		password: 'testpass',
	};

	const keyConfig = {
		host: 'bastion.example.com',
		port: '22',
		username: 'deploy',
		authMethod: 'privateKey',
		privateKeyContent: '-----BEGIN OPENSSH PRIVATE KEY-----\nfake\n-----END OPENSSH PRIVATE KEY-----',
		passphrase: 'keypass',
	};

	beforeEach(() => {
		manager = new TunnelManager();
		vi.clearAllMocks();

		// Default: SSH connects successfully
		mockSshOn.mockImplementation((event, callback) => {
			if (event === 'ready') {
				setTimeout(() => callback(), 0);
			}
		});

		// Default: server listens successfully
		mockServerListen.mockImplementation((_port, _host, callback) => {
			callback();
		});

		// Default: server closes successfully
		mockServerClose.mockImplementation((callback) => {
			if (callback) callback();
		});
	});

	afterEach(async () => {
		await manager.closeAll();
	});

	it('opens a tunnel and returns a local port', async () => {
		const port = await manager.open('win-1', sshConfig, 'es-host', 9200);

		expect(port).toBe(54321);
		expect(mockSshConnect).toHaveBeenCalledWith(
			expect.objectContaining({
				host: 'bastion.example.com',
				port: 22,
				username: 'deploy',
				password: 'testpass',
			})
		);
	});

	it('uses private key auth when authMethod is privateKey', async () => {
		await manager.open('win-1', keyConfig, 'es-host', 9200);

		expect(mockSshConnect).toHaveBeenCalledWith(
			expect.objectContaining({
				privateKey: keyConfig.privateKeyContent,
				passphrase: 'keypass',
			})
		);
		// Should NOT send password for key-based auth
		expect(mockSshConnect).toHaveBeenCalledWith(
			expect.not.objectContaining({
				password: expect.anything(),
			})
		);
	});

	it('rejects when SSH connection fails', async () => {
		mockSshOn.mockImplementation((event, callback) => {
			if (event === 'error') {
				setTimeout(() => callback(new Error('Authentication failed')), 0);
			}
		});

		await expect(
			manager.open('win-1', sshConfig, 'es-host', 9200)
		).rejects.toThrow('SSH connection failed: Authentication failed');
	});

	it('returns local port for an active tunnel', async () => {
		await manager.open('win-1', sshConfig, 'es-host', 9200);
		expect(manager.getLocalPort('win-1')).toBe(54321);
	});

	it('returns null for non-existent tunnel', () => {
		expect(manager.getLocalPort('non-existent')).toBeNull();
	});

	it('reports active status correctly', async () => {
		expect(manager.isActive('win-1')).toBe(false);
		await manager.open('win-1', sshConfig, 'es-host', 9200);
		expect(manager.isActive('win-1')).toBe(true);
	});

	it('closes an active tunnel', async () => {
		await manager.open('win-1', sshConfig, 'es-host', 9200);
		await manager.close('win-1');

		expect(mockSshRemoveAllListeners).toHaveBeenCalled();
		expect(mockSshEnd).toHaveBeenCalled();
		expect(mockServerClose).toHaveBeenCalled();
		expect(manager.getLocalPort('win-1')).toBeNull();
		expect(manager.isActive('win-1')).toBe(false);
	});

	it('close is a no-op for unknown windowId', async () => {
		await expect(manager.close('unknown')).resolves.toBeUndefined();
	});

	it('replaces existing tunnel when opening with same windowId', async () => {
		await manager.open('win-1', sshConfig, 'es-host', 9200);
		await manager.open('win-1', sshConfig, 'es-host', 9200);

		// Should have closed the first one
		expect(mockSshEnd).toHaveBeenCalledTimes(1);
		expect(manager.isActive('win-1')).toBe(true);
	});

	it('closeAll closes all active tunnels', async () => {
		await manager.open('win-1', sshConfig, 'es-host', 9200);
		await manager.open('win-2', sshConfig, 'es-host', 9200);

		await manager.closeAll();

		expect(manager.isActive('win-1')).toBe(false);
		expect(manager.isActive('win-2')).toBe(false);
	});

	it('supports multiple concurrent tunnels for different windows', async () => {
		await manager.open('win-1', sshConfig, 'es-host', 9200);
		await manager.open('win-2', sshConfig, 'es-host', 9201);

		expect(manager.isActive('win-1')).toBe(true);
		expect(manager.isActive('win-2')).toBe(true);
	});
});
