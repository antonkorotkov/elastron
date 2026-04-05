import { json } from '@sveltejs/kit';
import { tunnelManager } from '$lib/server/tunnel';

export async function POST({ request }) {
	let body;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid JSON payload' }, { status: 400 });
	}

	const { windowId, connection } = body;

	if (!windowId) {
		return json({ error: 'windowId is required' }, { status: 400 });
	}

	if (!connection?.ssh) {
		return json({ error: 'SSH configuration is required' }, { status: 400 });
	}

	const { ssh, host, port } = connection;

	if (!ssh.host || !ssh.username) {
		return json({ error: 'SSH host and username are required' }, { status: 400 });
	}

	if (ssh.authMethod === 'privateKey' && !ssh.privateKeyContent) {
		return json({ error: 'Private key content is required for privateKey auth' }, { status: 400 });
	}

	if (ssh.authMethod !== 'privateKey' && !ssh.password) {
		return json({ error: 'SSH password is required for password auth' }, { status: 400 });
	}

	let remoteHost = 'localhost';
	let remotePort = Number(port) || 9200;

	if (host) {
		const normalizedHost = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(host) ? host : `http://${host}`;
		try {
			const parsedHost = new URL(normalizedHost);
			remoteHost = parsedHost.hostname || 'localhost';
			if (!port && parsedHost.port) {
				remotePort = Number(parsedHost.port);
			}
		} catch {
			// fallback directly
			remoteHost = host;
		}
	}

	try {
		const localPort = await tunnelManager.open(windowId, ssh, remoteHost, remotePort);
		return json({ data: { localPort } });
	} catch (err) {
		console.error('SSH Tunnel Error:', err);
		return json({ error: err.message }, { status: 500 });
	}
}
