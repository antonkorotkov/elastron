import { handleElasticRequest } from '$lib/server/elastic';

export async function POST({ request }) {
	return handleElasticRequest(request, async (client, args) => {
		const { index, mapping } = args;
		const types = Object.getOwnPropertyNames(mapping);
		if (types.length === 1 && types[0] === 'properties') {
			const response = await client.transport.request({
				method: 'PUT',
				path: `/${index}/_mapping`,
				body: mapping
			});
			return response.body !== undefined ? response.body : response;
		} else {
			const responses = [];
			for (const i in mapping) {
				const response = await client.transport.request({
					method: 'POST',
					path: `/${index}/_mapping/${i}`,
					body: mapping[i]
				});
				responses.push(response.body !== undefined ? response.body : response);
			}
			return responses;
		}
	});
}
