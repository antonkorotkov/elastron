import { handleSecurityRequest, unwrap } from '$lib/server/security/request.js';

export async function POST({ request }) {
	return handleSecurityRequest(request, async (client, { id }) =>
		unwrap(
			await client.transport.request({
				method: 'DELETE',
				path: '/_security/api_key',
				body: { ids: [id] },
			})
		)
	);
}
