import { handleElasticRequest } from '$lib/server/elastic';

export async function POST({ request }) {
	return handleElasticRequest(request, async (client, args) => {
		const { index, type = '_doc', id, params = {} } = args;
		const response = await client.transport.request({
			method: 'DELETE',
			path: `/${index}/${type}/${id}`,
			querystring: params
		});
		return response.body !== undefined ? response.body : response;
	});
}
