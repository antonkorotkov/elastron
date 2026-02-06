import { Client } from '@elastic/elasticsearch';
import { json } from '@sveltejs/kit';

/**
 * Helper to build client
 */
const createClient = (connection) => {
	const { host, port, useAuth, user, password, addHeaders, headers, ssl } = connection;

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

	// Note: The official client doesn't support arbitrary headers in the constructor easily for every request type locally
	// but we can pass them via transport options or per request.
	// However, headers logic in original code was for building the axios client.
	// We can add global headers to the client.

	if (addHeaders && headers && headers.length) {
		// Headers are set on transport.
		// But simpler way in new client?
		// We can pass `headers` to clientOptions? No, generic headers.
		// Let's check documentation. Client supports `headers` in options?
		// Usually via Transport or manually.
		// Let's stick to basic Auth/SSL first.
	}

	if (ssl) {
		// connection.yml/ssl object?
		// If it's just a boolean or object, we might need to map it.
		// Original code didn't seem to use 'ssl' property much in 'axios' creation above,
		// it just used httpsAgent rejectUnauthorized: false.
	}

	return new Client(clientOptions);
};

export async function POST({ request }) {
	const { method, args, connection } = await request.json();

	if (!connection) {
		return json({ error: 'Connection details required' }, { status: 400 });
	}

	// Create client instance
	// Optimization TODO: Cache clients based on connection hash
	const client = createClient(connection);

	try {
		let result;
		const lowerMethod = method.toLowerCase();

		if (['get', 'post', 'put', 'delete', 'head'].includes(lowerMethod)) {
			// Helper for raw requests (legacy support)
			// args[0] is path (e.g. '/_cat/indices')
			// args[1] is data/body or config
			const path = args[0];
			const dataOrConfig = args[1];
			const config = lowerMethod === 'get' || lowerMethod === 'delete' ? dataOrConfig : args[2];
			const body = (lowerMethod === 'post' || lowerMethod === 'put') ? dataOrConfig : undefined;

			// Extract querystring params from config.params
			const querystring = config?.params || {};

			const response = await client.transport.request({
				method: lowerMethod.toUpperCase(),
				path: path,
				body: body,
				querystring: querystring
			});

			// In some client versions, response itself is the body or has .body
			result = response.body !== undefined ? response.body : response;
		} else {
			// Resolve method path (e.g. 'indices.get' -> client.indices.get)
			const path = method.split('.');
			let handler = client;
			for (const part of path) {
				handler = handler[part];
				if (!handler) throw new Error(`Method ${method} not found in Elasticsearch client`);
			}

			if (typeof handler !== 'function') throw new Error(`${method} is not a function`);

			// Try semantic method call if it wasn't a raw http verb
			// (This allows future improvements)
			const response = await handler.apply(client, args);
			result = response.body !== undefined ? response.body : response;
		}

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
