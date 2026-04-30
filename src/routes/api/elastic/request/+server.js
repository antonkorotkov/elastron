import { handleElasticRequest } from '$lib/server/elastic';

export async function POST({ request }) {
	return handleElasticRequest(request, async (client, args) => {
		const { method, path, querystring, elasticBody, headers } = args;

		const requestParams = {
			method: method || 'GET',
			path: path || '/',
		};

		if (querystring) {
			requestParams.querystring = querystring;
		}

		if (elasticBody) {
			requestParams.body = elasticBody;
		}

		if (headers && Object.keys(headers).length > 0) {
			requestParams.headers = headers;
		}

		const response = await client.transport.request(requestParams);
		return response.body !== undefined ? response.body : response;
	});
}
