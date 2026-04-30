import { handleElasticRequest } from '$lib/server/elastic';

export async function POST({ request }) {
	return handleElasticRequest(request, async (client, args) => {
		const { index, type = '_doc', id, fields = {} } = args;
		const response = await client.transport.request({
			method: 'PUT',
			path: `/${index}/${type}/${id}`,
			body: fields
		});
		return response.body !== undefined ? response.body : response;
	});
}
