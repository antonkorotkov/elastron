import { handleElasticRequest } from '$lib/server/elastic';

export async function POST({ request }) {
	return handleElasticRequest(request, async (client, args) => {
		const { existingIndex, newIndex } = args;
		const response = await client.transport.request({
			method: 'POST',
			path: `/${existingIndex}/_clone/${newIndex}`
		});
		return response.body !== undefined ? response.body : response;
	});
}
