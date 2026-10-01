import { handleElasticRequest } from '$lib/server/elastic';
import { performRequest } from '$lib/server/request';

export async function POST({ request }) {
	return handleElasticRequest(request, performRequest);
}
