import { handleSecurityRequest, unwrap } from '$lib/server/security/request.js';

// Creates or updates a native user. The body carries a password on creation,
// which is why every failure here is logged through the redacted record.
export async function POST({ request }) {
	return handleSecurityRequest(request, async (client, { username, body }) =>
		unwrap(
			await client.transport.request({
				method: 'POST',
				path: `/_security/user/${encodeURIComponent(username)}`,
				body,
			})
		)
	);
}
