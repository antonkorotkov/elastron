import { handleSecurityRequest, unwrap } from '$lib/server/security/request.js';

export async function POST({ request }) {
	return handleSecurityRequest(request, async client =>
		unwrap(await client.transport.request({ method: 'GET', path: '/_security/role' }))
	);
}
