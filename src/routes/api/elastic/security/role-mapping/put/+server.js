import { handleSecurityRequest, unwrap } from '$lib/server/security/request.js';

// The body is the mapping as the editor holds it, so rules and templates the
// form does not model pass straight through to the cluster.
export const POST = async ({ request }) =>
	handleSecurityRequest(request, async (client, { name, body }) =>
		unwrap(
			await client.transport.request({
				method: 'PUT',
				path: `/_security/role_mapping/${encodeURIComponent(name)}`,
				body,
			})
		)
	);
