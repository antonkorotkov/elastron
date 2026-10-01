import { STATUS_CODES } from 'node:http';

const toResult = ({ statusCode, headers, body }) => ({
	statusCode,
	statusText: STATUS_CODES[statusCode] || '',
	contentType: headers?.['content-type'] || '',
	body,
});

// A status the cluster answered with is a response to show, not a failure;
// only errors without a cluster response propagate. Retries are off so a
// failed write is sent once and the status shown is that of a single attempt.
export const performRequest = async (client, { method, path, querystring, elasticBody }) => {
	const params = {
		method: method || 'GET',
		path: path || '/',
	};

	if (querystring) params.querystring = querystring;
	if (elasticBody) params.body = elasticBody;

	try {
		return toResult(await client.transport.request(params, { meta: true, maxRetries: 0 }));
	} catch (err) {
		if (err?.name === 'ResponseError' && err.meta?.statusCode) return toResult(err.meta);
		throw err;
	}
};
