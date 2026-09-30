import { handleSecurityRequest, unwrap } from '$lib/server/security/request.js';
import { buildRoleQuery, ROLE_PAGE_SIZE } from '$lib/security/roleSearch.js';
import { lacksQueryEndpoint } from '$lib/server/security/queryEndpoint.js';

const fullList = async client => ({
	mode: 'full',
	roles: unwrap(await client.transport.request({ method: 'GET', path: '/_security/role' })),
});

const page = async (client, { search, direction, after }) => {
	const body = unwrap(
		await client.transport.request({
			method: 'POST',
			path: '/_security/_query/role',
			body: {
				size: ROLE_PAGE_SIZE,
				sort: [{ name: { order: direction === 'desc' ? 'desc' : 'asc' } }],
				...(buildRoleQuery(search) ? { query: buildRoleQuery(search) } : {}),
				...(Array.isArray(after) ? { search_after: after } : {}),
			},
		})
	);
	const roles = (body?.roles || []).map(role => {
		const copy = { ...role };
		delete copy._sort;
		return copy;
	});
	const last = body?.roles?.[body.roles.length - 1];
	return {
		mode: 'paged',
		roles,
		total: body?.total ?? roles.length,
		cursor: roles.length === ROLE_PAGE_SIZE ? (last?._sort ?? null) : null,
	};
};

export const POST = async ({ request }) =>
	handleSecurityRequest(request, async (client, { full, ...params }) => {
		if (full) return fullList(client);
		try {
			return await page(client, params);
		} catch (err) {
			if (!lacksQueryEndpoint(err, 'role')) throw err;
			return fullList(client);
		}
	});
