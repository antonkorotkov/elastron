import { Client as Client8 } from 'elasticsearch8';
import { Client as Client9 } from 'elasticsearch9';
import { json } from '@sveltejs/kit';
import { tunnelManager } from './tunnel';

/**
 * Creates an Elasticsearch client instance configured with connection details,
 * specifically ensuring authorization and custom connection flags work properly.
 */
export const createClient = (connection) => {
	const { host, port, useAuth, user, password, addHeaders, headers, version } = connection;

	// ensure host has protocol
	let safeHost = host;
	if (!safeHost.startsWith('http')) safeHost = 'http://' + safeHost;
	const node = `${safeHost.replace(/\/+$/, '')}${Number(port) > 0 ? `:${port}` : ''}`;

	const clientOptions = {
		node,
		requestTimeout: 30000,
		maxRetries: 3,
		tls: {
			rejectUnauthorized: false
		}
	}

	if (useAuth) {
		clientOptions.auth = {
			username: user,
			password: password
		}
	}

	if (addHeaders && Array.isArray(headers)) {
		const customHeaders = {};
		for (const header of headers) {
			if (header.name && header.value) {
				customHeaders[header.name] = header.value;
			}
		}
		if (Object.keys(customHeaders).length > 0) {
			clientOptions.headers = customHeaders;
		}
	}

	// Select the appropriate client version
	if (version && version.startsWith('9')) {
		return new Client9(clientOptions);
	}

	// Default to v8 client
	return new Client8(clientOptions);
};

/**
 * Helper to process the incoming SvelteKit request, extract connection info,
 * create a client, perform an action, and handle any errors.
 *
 * When an SSH tunnel is active for the requesting window, the connection
 * is transparently rewritten to route through localhost:tunnelPort.
 */
export async function handleElasticRequest(request, action) {
	let body;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid JSON payload' }, { status: 400 });
	}

	const { connection, windowId, ...params } = body;

	if (!connection) {
		return json({ error: 'Connection details required' }, { status: 400 });
	}

	// Rewrite connection to route through SSH tunnel if active
	let effectiveConnection = connection;
	if (connection.useSshTunnel && windowId) {
		const localPort = tunnelManager.getLocalPort(windowId);
		if (localPort) {
			effectiveConnection = {
				...connection,
				host: 'http://127.0.0.1',
				port: String(localPort),
			};
		}
	}

	const client = createClient(effectiveConnection);

	try {
		const result = await action(client, params);
		return json({ data: result });
	} catch (err) {
		console.error("Elasticsearch Error", err);
		const reason =
			err.meta?.body?.error?.root_cause?.[0]?.reason ||
			err.meta?.body?.error?.reason ||
			err.message;
		return json({ error: reason }, { status: 500 });
	} finally {
		await client.close();
	}
}
