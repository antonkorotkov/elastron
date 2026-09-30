import { handleSecurityRequest, unwrap } from '$lib/server/security/request.js';

// Answers only the roles that exist. The cluster returns 404 when none of the
// names do, which here is an empty answer rather than a failure.
export const POST = async ({ request }) =>
	handleSecurityRequest(request, async (client, { names }) => {
		const wanted = (names || []).filter(Boolean);
		if (!wanted.length) return {};
		try {
			return unwrap(
				await client.transport.request({
					method: 'GET',
					path: `/_security/role/${wanted.map(encodeURIComponent).join(',')}`,
				})
			);
		} catch (err) {
			if ((err?.meta?.statusCode ?? err?.statusCode) === 404) return {};
			throw err;
		}
	});
