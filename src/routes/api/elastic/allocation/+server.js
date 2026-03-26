import { handleElasticRequest } from '$lib/server/elastic';

export async function POST({ request }) {
	return handleElasticRequest(request, async (client) => {
		const response = await client.transport.request({
			method: 'GET',
			path: '/_cat/allocation',
			querystring: { format: 'json' }
		});
		return response.body !== undefined ? response.body : response;
	});
}
