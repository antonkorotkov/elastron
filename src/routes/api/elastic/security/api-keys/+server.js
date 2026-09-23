import { handleSecurityRequest, unwrap } from '$lib/server/security/request.js';

/**
 * `owner: true` asks only for the connected account's own keys. The surface
 * retries with it when the unscoped listing is refused, which is what an
 * account holding only `manage_own_api_key` gets.
 */
export async function POST({ request }) {
	return handleSecurityRequest(request, async (client, { owner }) =>
		unwrap(
			await client.transport.request({
				method: 'GET',
				path: '/_security/api_key',
				querystring: owner ? { owner: 'true' } : undefined,
			})
		)
	);
}
