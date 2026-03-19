import { handleElasticRequest } from '$lib/server/elastic';

export async function POST({ request }) {
	return handleElasticRequest(request, async (client, args) => {
		const { index, id, fields = {} } = args;
		const response = await client.transport.request({
			method: 'POST',
			path: `/${index}/_update/${id}`,
			querystring: { refresh: 'true' },
			body: { doc: fields }
		});
		return response.body !== undefined ? response.body : response;
	});
}
