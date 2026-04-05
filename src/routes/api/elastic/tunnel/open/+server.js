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

	// Determine the remote ES host/port from the connection
	let remoteHost = host || 'localhost';
	// Strip protocol for SSH forwarding — we need the raw hostname
	remoteHost = remoteHost.replace(/^https?:\/\//, '').replace(/\/+$/, '');
	const remotePort = Number(port) || 9200;

	try {
		const localPort = await tunnelManager.open(windowId, ssh, remoteHost, remotePort);
		return json({ data: { localPort } });
	} catch (err) {
		console.error('SSH Tunnel Error:', err);
		return json({ error: err.message }, { status: 500 });
	}
}
