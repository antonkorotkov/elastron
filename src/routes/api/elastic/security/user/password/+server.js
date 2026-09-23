import { handleSecurityRequest, unwrap } from '$lib/server/security/request.js';

export async function POST({ request }) {
	return handleSecurityRequest(request, async (client, { username, password }) =>
		unwrap(
			await client.transport.request({
				method: 'PUT',
				path: `/_security/user/${encodeURIComponent(username)}/_password`,
				body: { password },
			})
		)
	);
}
