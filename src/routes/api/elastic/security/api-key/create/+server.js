import { handleSecurityRequest, unwrap } from '$lib/server/security/request.js';

// The response carries the only copy of the generated secret. It is handed
// straight to the renderer, shown once, and never stored.
export async function POST({ request }) {
	return handleSecurityRequest(request, async (client, { body }) =>
		unwrap(await client.transport.request({ method: 'POST', path: '/_security/api_key', body }))
	);
}
