import { handleSecurityRequest, unwrap } from '$lib/server/security/request.js';

/**
 * Renders a templated document query.
 *
 * The role API accepts a template whose Mustache syntax is broken and only
 * fails later, when a user's request is evaluated, so the role looks saved
 * while quietly denying access. This endpoint rejects the same source, which
 * is why a template is rendered before the role is saved.
 *
 * The sample user is only for rendering: `_user` is what a role template
 * interpolates, and a value has to be supplied for the render to complete.
 */
export async function POST({ request }) {
	return handleSecurityRequest(request, async (client, { source, username }) => {
		// A document query is a bare query, but the render endpoint validates
		// what it produces as a search body and rejects a bare `term` with
		// "Unknown key for a START_OBJECT in [term]". Wrapping the template
		// textually keeps the check about the template rather than the shape.
		const rendered = unwrap(
			await client.transport.request({
				method: 'POST',
				path: '/_render/template',
				body: {
					source: `{"query":${source}}`,
					params: { _user: { username: username || 'preview_user', metadata: {}, roles: [] } },
				},
			})
		);

		return { query: rendered?.template_output?.query ?? null };
	});
}
