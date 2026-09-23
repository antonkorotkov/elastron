import { handleSecurityRequest, unwrap } from '$lib/server/security/request.js';

export async function POST({ request }) {
	return handleSecurityRequest(request, async (client, { name }) =>
		unwrap(
			await client.transport.request({
				method: 'DELETE',
				path: `/_security/role/${encodeURIComponent(name)}`,
			})
		)
	);
}
