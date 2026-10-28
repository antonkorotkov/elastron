import { handleSecurityRequest, unwrap } from '$lib/server/security/request.js';
import { isReadOnlyMapping } from '$lib/security/mappingRules.js';

// The cluster answers a missing name, and a read-only one, with a bare
// `found: false`, which would otherwise surface as an unexplained refusal.
export const POST = async ({ request }) =>
	handleSecurityRequest(request, async (client, { name }) => {
		try {
			return unwrap(
				await client.transport.request({
					method: 'DELETE',
					path: `/_security/role_mapping/${encodeURIComponent(name)}`,
				})
			);
		} catch (err) {
			if ((err?.meta?.statusCode ?? err?.statusCode) === 404) {
				const message = isReadOnlyMapping(name)
					? `The role mapping "${name}" is defined in the cluster's operator settings and cannot be deleted here.`
					: `The role mapping "${name}" does not exist on the cluster.`;
				throw new Error(message, { cause: err });
			}
			throw err;
		}
	});
