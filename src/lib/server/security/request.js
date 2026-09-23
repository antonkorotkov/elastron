import { json } from '@sveltejs/kit';
import {
	withElasticClient,
	isUnreachableError,
	getErrorReason,
	describeErrorForLog,
} from '../elastic.js';
import { describeSecurityFailure } from '../../security/causes.js';

/**
 * The security counterpart to `handleElasticRequest`.
 *
 * It behaves identically on the happy path, and on failure additionally
 * attaches the classified cause so a surface can name it instead of echoing
 * the cluster. Logging goes through the same redacted record, which matters
 * more here than anywhere else: these request bodies carry passwords.
 */
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
				// `error` stays the user-facing sentence; `reason` carries the
				// cluster's own wording as supporting detail only.
				error: message || getErrorReason(err),
				cause,
				reason,
				...(unreachable ? { unreachable: true } : {}),
			},
			{ status: 500 }
		);
	}
};

/** Unwraps the two response shapes the transport can return. */
export const unwrap = response => (response?.body !== undefined ? response.body : response);
