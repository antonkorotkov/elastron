import { handleElasticRequest } from '$lib/server/elastic';

export async function POST({ request }) {
	return handleElasticRequest(request, async (client, params) => {
		const { index, type, query, size, from, sort, _source, explain } = params;
		const pathStr = `${index ? `/${index}` : ''}${type ? `/${type}` : ''}/_search`;
		
		const response = await client.transport.request({
			method: 'GET',
			path: pathStr,
			querystring: {
				q: query,
				size,
				from,
				sort,
				_source,
				explain,
			}
		});
		return response.body !== undefined ? response.body : response;
	});
}
