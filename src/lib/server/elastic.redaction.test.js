import { describe, it, expect } from 'vitest';
import { errors as errors8 } from 'elasticsearch8';
import { errors as errors9 } from 'elasticsearch9';
import { describeErrorForLog } from './elastic';

// Builds the error an Elasticsearch client raises for a rejected security
// write, with the request body the client attaches to it.
const rejectedUserWrite = (errors, body) =>
	new errors.ResponseError({
		statusCode: 403,
		headers: {},
		warnings: [],
		body: {
			error: {
				type: 'security_exception',
				reason: 'action [cluster:admin/xpack/security/user/put] is unauthorized',
			},
		},
		meta: {
			request: {
				params: {
					method: 'PUT',
					path: '/_security/user/alice',
					body,
				},
				options: {},
				id: 1,
			},
			connection: null,
			attempts: 0,
			aborted: false,
			context: null,
			name: 'elasticsearch-js',
		},
	});

describe.each([
	['v8', errors8],
	['v9', errors9],
])('describeErrorForLog with the %s client', (_label, errors) => {
	const secret = 'sup3rs3cr3t-passphrase';

	it('keeps no trace of the request body', () => {
		const err = rejectedUserWrite(errors, JSON.stringify({ password: secret, roles: ['superuser'] }));
		const logged = JSON.stringify(describeErrorForLog(err));

		expect(logged).not.toContain(secret);
		expect(logged).not.toContain('password');
	});

	it('redacts a body the client left as an object', () => {
		const err = rejectedUserWrite(errors, { password: secret });
		expect(JSON.stringify(describeErrorForLog(err))).not.toContain(secret);
	});

	it('still records what is needed to diagnose the failure', () => {
		const err = rejectedUserWrite(errors, JSON.stringify({ password: secret }));
		expect(describeErrorForLog(err)).toMatchObject({
			status: 403,
			method: 'PUT',
			path: '/_security/user/alice',
			reason: 'action [cluster:admin/xpack/security/user/put] is unauthorized',
		});
	});

	it('does not throw on an error carrying no request metadata', () => {
		expect(describeErrorForLog(new Error('boom'))).toMatchObject({
			name: 'Error',
			reason: 'boom',
		});
		expect(() => describeErrorForLog(null)).not.toThrow();
	});
});
