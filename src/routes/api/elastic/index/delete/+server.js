import { handleElasticRequest } from '$lib/server/elastic';

export async function POST({ request }) {
	return handleElasticRequest(request, async (client, args) => {
		const { index } = args;
		const response = await client.transport.request({
			method: 'DELETE',
			path: `/${index}`
		});
		return response.body !== undefined ? response.body : response;
	});
}
