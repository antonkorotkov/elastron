import { handleElasticRequest } from '$lib/server/elastic';

export async function POST({ request }) {
	return handleElasticRequest(request, async (client, args) => {
		const { index, settings = {} } = args;
		const response = await client.transport.request({
			method: 'PUT',
			path: `/${index}`,
			body: settings
		});
		return response.body !== undefined ? response.body : response;
	});
}
