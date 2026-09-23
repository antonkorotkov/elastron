import { handleSecurityRequest, unwrap } from '$lib/server/security/request.js';

// Privilege names are read from the connected cluster rather than compiled in,
// which is what lets the security area work across Elasticsearch 8 and 9 with
// no version branching. 9.x adds `monitor_esql`; nothing here needs to know.
export async function POST({ request }) {
	return handleSecurityRequest(request, async client =>
		unwrap(await client.transport.request({ method: 'GET', path: '/_security/privilege/_builtin' }))
	);
}
