import { json } from '@sveltejs/kit';
import {
	withElasticClient,
	isUnreachableError,
	getErrorReason,
	describeErrorForLog,
} from '../elastic.js';
import { describeSecurityFailure } from '../../security/causes.js';

// As handleElasticRequest, but attaches the classified cause so a surface can
// name it instead of echoing the cluster.
export const handleSecurityRequest = async (request, action) => {
	let body;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid JSON payload' }, { status: 400 });
	}

	const { connection, windowId, ...params } = body;

	if (!connection) {
		return json({ error: 'Connection details required' }, { status: 400 });
	}

	try {
		const result = await withElasticClient(connection, windowId, client => action(client, params));
		return json({ data: result });
	} catch (err) {
		console.error('Elasticsearch Security Error', describeErrorForLog(err));

		const unreachable = isUnreachableError(err);
		const { cause, message, reason } = describeSecurityFailure(
			unreachable ? Object.assign(err, { unreachable: true }) : err
		);

		return json(
			{
				error: message || getErrorReason(err),
				cause,
				reason,
				...(unreachable ? { unreachable: true } : {}),
			},
			{ status: 500 }
		);
	}
};

export const unwrap = response => (response?.body !== undefined ? response.body : response);
