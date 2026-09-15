import { Client as Client8 } from 'elasticsearch8';
import { Client as Client9 } from 'elasticsearch9';
import { json } from '@sveltejs/kit';
import { tunnelManager } from './tunnel';
import { getVersionNumber } from '../utils/helpers';

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
	if (getVersionNumber(version)?.startsWith('9')) {
		return new Client9(clientOptions);
	}

	// Default to v8 client
	return new Client8(clientOptions);
};

/**
 * When an SSH tunnel is active for the window, the connection is rewritten
 * to route through localhost:tunnelPort. Otherwise it is returned unchanged.
 */
export const resolveEffectiveConnection = (connection, windowId) => {
	if (!connection.useSshTunnel || !windowId) return connection;

	const localPort = tunnelManager.getLocalPort(windowId);
	if (!localPort) return connection;

	return {
		...connection,
		host: 'http://127.0.0.1',
		port: String(localPort),
	};
};

/**
 * Runs `fn` with a client for the connection, routed through the window's
 * SSH tunnel when one is active, and always closes the client afterwards.
 * Shared by the HTTP routes and the in-process AI tools so both honor the
 * tunnel the same way.
 */
export const withElasticClient = async (connection, windowId, fn) => {
	const client = createClient(resolveEffectiveConnection(connection, windowId));
	try {
		return await fn(client);
	} finally {
		await client.close();
	}
};

// Errors meaning the cluster could not be reached at all, as opposed to a
// ResponseError, which the cluster itself returned. Both bundled client
// versions use these names.
const UNREACHABLE_ERROR_NAMES = new Set([
	'ConnectionError',
	'TimeoutError',
	'NoLivingConnectionsError',
]);

export const isUnreachableError = err => UNREACHABLE_ERROR_NAMES.has(err?.name);

// The client's connection errors can carry an empty message, which used to
// reach the user as "Unknown server error"; name the cause instead.
export const getErrorReason = err =>
	err?.meta?.body?.error?.root_cause?.[0]?.reason ||
	err?.meta?.body?.error?.reason ||
	err?.message ||
	(isUnreachableError(err) ? `The cluster could not be reached (${err.name}).` : undefined);

/**
 * Helper to process the incoming SvelteKit request, extract connection info,
 * create a client, perform an action, and handle any errors.
 *
 * Error responses carry `unreachable: true` when the cluster could not be
 * reached, so the renderer can tell a dead cluster from an error response.
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

	try {
		const result = await withElasticClient(connection, windowId, client =>
			action(client, params)
		);
		return json({ data: result });
	} catch (err) {
		console.error("Elasticsearch Error", err);
		return json(
			{
				error: getErrorReason(err),
				...(isUnreachableError(err) ? { unreachable: true } : {}),
			},
			{ status: 500 }
		);
	}
}
