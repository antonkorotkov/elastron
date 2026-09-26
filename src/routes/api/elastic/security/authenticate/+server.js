import { handleSecurityRequest, unwrap } from '$lib/server/security/request.js';

// Identifies the account the connection authenticates as. This is what the
// self-lockout guard compares against; it is not a privilege probe.
export async function POST({ request }) {
	return handleSecurityRequest(request, async client =>
		unwrap(await client.transport.request({ method: 'GET', path: '/_security/_authenticate' }))
	);
}
