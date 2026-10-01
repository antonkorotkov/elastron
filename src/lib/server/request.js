import { STATUS_CODES } from 'node:http';

const toResult = ({ statusCode, headers, body }) => ({
	statusCode,
	statusText: STATUS_CODES[statusCode] || '',
	contentType: headers?.['content-type'] || '',
	body,
});

// A status the cluster answered with is a response to show, not a failure;
// only errors without a cluster response propagate.
export const performRequest = async (client, { method, path, querystring, elasticBody, headers }) => {
	const params = {
		method: method || 'GET',
		path: path || '/',
	};

	if (querystring) params.querystring = querystring;
	if (elasticBody) params.body = elasticBody;
	if (headers && Object.keys(headers).length > 0) params.headers = headers;

	try {
		return toResult(await client.transport.request(params, { meta: true }));
	} catch (err) {
		if (err?.name === 'ResponseError' && err.meta?.statusCode) return toResult(err.meta);
		throw err;
	}
};
