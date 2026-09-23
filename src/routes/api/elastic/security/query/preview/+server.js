import { handleSecurityRequest, unwrap } from '$lib/server/security/request.js';

/**
 * Counts the documents a block's query matches across its index patterns.
 *
 * Syntax checking cannot tell the user whether a query does what they meant; a
 * query matching nothing is valid and almost certainly wrong. This is offered
 * as help only: an account holding just `manage_security` is refused this while
 * still being allowed to save the role, so the caller treats a refusal as
 * "no preview" rather than as a failure.
 */
export async function POST({ request }) {
	return handleSecurityRequest(request, async (client, { names, query }) => {
		const patterns = (Array.isArray(names) ? names : []).filter(Boolean)
		if (patterns.length === 0) return { unavailable: true, reason: 'no-patterns' };

		const total = unwrap(
			await client.transport.request({
				method: 'POST',
				path: `/${encodeURIComponent(patterns.join(','))}/_count`,
			})
		);

		const matching = unwrap(
			await client.transport.request({
				method: 'POST',
				path: `/${encodeURIComponent(patterns.join(','))}/_count`,
				body: { query },
			})
		);

		return { matching: matching?.count ?? 0, total: total?.count ?? 0 };
	});
}
