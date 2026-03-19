import { handleElasticRequest } from '$lib/server/elastic';

export async function POST({ request }) {
	return handleElasticRequest(request, async (client, params) => {
		const { index, type, query } = params;
		const pathStr = `${index ? `/${index}` : ''}${type ? `/${type}` : ''}/_search`;
		
		const response = await client.transport.request({
			method: 'POST',
			path: pathStr,
			body: query || {}
		});
		return response.body !== undefined ? response.body : response;
	});
}
