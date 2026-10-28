import { handleSecurityRequest, unwrap } from '$lib/server/security/request.js';

// Every mapping when no names are given; the cluster has no paged listing for
// them and holds tens, not thousands. With names, a missing one is left out
// rather than failing the whole answer, as the role lookup does.
export const POST = async ({ request }) =>
	handleSecurityRequest(request, async (client, { names }) => {
		const wanted = (names || []).filter(Boolean);
		try {
			return unwrap(
				await client.transport.request({
					method: 'GET',
					path: wanted.length
						? `/_security/role_mapping/${wanted.map(encodeURIComponent).join(',')}`
						: '/_security/role_mapping',
				})
			);
		} catch (err) {
			if ((err?.meta?.statusCode ?? err?.statusCode) === 404) return {};
			throw err;
		}
	});
