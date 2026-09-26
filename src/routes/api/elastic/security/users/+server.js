import { handleSecurityRequest, unwrap } from '$lib/server/security/request.js';

// The plain user API is used rather than `_security/_query/user`: the query
// endpoint omits reserved accounts entirely, and does not exist before 8.14.
// See design.md for the measurements behind that choice.
export async function POST({ request }) {
	return handleSecurityRequest(request, async client =>
		unwrap(await client.transport.request({ method: 'GET', path: '/_security/user' }))
	);
}
