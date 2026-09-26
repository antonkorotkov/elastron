import { handleSecurityRequest, unwrap } from '$lib/server/security/request.js';

// The body is the role definition as the editor holds it, so fields the
// structured form does not model pass straight through to the cluster.
export async function POST({ request }) {
	return handleSecurityRequest(request, async (client, { name, body }) =>
		unwrap(
			await client.transport.request({
				method: 'PUT',
				path: `/_security/role/${encodeURIComponent(name)}`,
				body,
			})
		)
	);
}
