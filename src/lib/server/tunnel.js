import { Client as SSHClient } from 'ssh2';
import net from 'net';
import getPort from 'get-port';

/**
 * Represents an active SSH tunnel with its associated resources.
 * @typedef {Object} TunnelEntry
 * @property {SSHClient} sshClient - The SSH2 client instance
 * @property {net.Server} localServer - The local TCP server proxying connections
 * @property {number} localPort - The local port the server is listening on
 */

/**
 * Manages SSH tunnels keyed by windowId.
 * Each window maintains its own independent tunnel.
 */
class TunnelManager {
	/** @type {Map<string, TunnelEntry>} */
	#tunnels = new Map();

	/**
	 * Opens an SSH tunnel for the given window.
	 * Creates an SSH connection to the bastion host and a local TCP server
	 * that forwards all traffic through the SSH tunnel to the remote host.
	 *
	 * @param {string} windowId - Unique identifier for the window
	 * @param {Object} sshConfig - SSH connection configuration
	 * @param {string} sshConfig.host - SSH server hostname
	 * @param {string|number} sshConfig.port - SSH server port
	 * @param {string} sshConfig.username - SSH username
	 * @param {string} sshConfig.authMethod - 'password' or 'privateKey'
	 * @param {string} [sshConfig.password] - SSH password (if authMethod is 'password')
	 * @param {string} [sshConfig.privateKeyContent] - PEM key content (if authMethod is 'privateKey')
	 * @param {string} [sshConfig.passphrase] - Passphrase for encrypted private keys
	 * @param {string} remoteHost - The target host accessible from the SSH server
	 * @param {number} remotePort - The target port on the remote host
	 * @returns {Promise<number>} The local port to connect to
	 */
	async open(windowId, sshConfig, remoteHost, remotePort) {
		// Close existing tunnel for this window if any
		if (this.#tunnels.has(windowId)) {
			await this.close(windowId);
		}

		const localPort = await getPort();

		const sshClient = new SSHClient();

		// Build SSH connection options
		const connectOptions = {
			host: sshConfig.host,
			port: Number(sshConfig.port) || 22,
			username: sshConfig.username,
			readyTimeout: 15000,
		};

		if (sshConfig.authMethod === 'privateKey' && sshConfig.privateKeyContent) {
			connectOptions.privateKey = sshConfig.privateKeyContent;
			if (sshConfig.passphrase) {
				connectOptions.passphrase = sshConfig.passphrase;
			}
		} else {
			connectOptions.password = sshConfig.password;
		}

		// Wait for SSH connection to be ready
		await new Promise((resolve, reject) => {
			sshClient.on('ready', resolve);
			sshClient.on('error', (err) => {
				reject(new Error(`SSH connection failed: ${err.message}`));
			});
			sshClient.connect(connectOptions);
		});

		// Create local TCP server that forwards connections through SSH
		const localServer = net.createServer((socket) => {
			sshClient.forwardOut(
				'127.0.0.1',
				localPort,
				remoteHost,
				remotePort,
				(err, stream) => {
					if (err) {
						socket.destroy();
						return;
					}
					socket.pipe(stream).pipe(socket);

					stream.on('error', () => socket.destroy());
					socket.on('error', () => stream.destroy());
				}
			);
		});

		// Start the local server
		try {
			await new Promise((resolve, reject) => {
				localServer.on('error', reject);
				localServer.listen(localPort, '127.0.0.1', resolve);
			});
		} catch (err) {
			sshClient.removeAllListeners();
			sshClient.end();
			throw new Error(`Local port binding failed: ${err.message}`, { cause: err });
		}

		// Handle SSH disconnection
		sshClient.on('close', () => {
			this.#cleanup(windowId);
		});

		sshClient.on('end', () => {
			this.#cleanup(windowId);
		});

		this.#tunnels.set(windowId, { sshClient, localServer, localPort });

		return localPort;
	}

	/**
	 * Closes the SSH tunnel for the given window.
	 * @param {string} windowId
	 */
	async close(windowId) {
		const entry = this.#tunnels.get(windowId);
		if (!entry) return;

		this.#tunnels.delete(windowId);

		entry.sshClient.removeAllListeners();
		entry.sshClient.end();

		await new Promise((resolve) => {
			entry.localServer.close(resolve);
		});
	}

	/**
	 * Internal cleanup when SSH connection drops unexpectedly.
	 * @param {string} windowId
	 */
	#cleanup(windowId) {
		const entry = this.#tunnels.get(windowId);
		if (!entry) return;

		this.#tunnels.delete(windowId);

		try {
			entry.localServer.close();
		} catch {
			// Ignore errors during cleanup
		}
	}

	/**
	 * Returns the local port for an active tunnel, or null.
	 * @param {string} windowId
	 * @returns {number|null}
	 */
	getLocalPort(windowId) {
		return this.#tunnels.get(windowId)?.localPort ?? null;
	}

	/**
	 * Returns whether a tunnel is active for the given window.
	 * @param {string} windowId
	 * @returns {boolean}
	 */
	isActive(windowId) {
		return this.#tunnels.has(windowId);
	}

	/**
	 * Closes all active tunnels.
	 */
	async closeAll() {
		const windowIds = [...this.#tunnels.keys()];
		await Promise.all(windowIds.map((id) => this.close(id)));
	}
}

// Module-level singleton
export const tunnelManager = new TunnelManager();

// Also export the class for testing
export { TunnelManager };
