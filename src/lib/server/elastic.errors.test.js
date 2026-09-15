import { describe, it, expect } from 'vitest';
import { errors as errors8 } from 'elasticsearch8';
import { errors as errors9 } from 'elasticsearch9';
import { isUnreachableError } from './elastic';

// Uses the real error classes from both bundled clients, so a rename in either
// client version would fail here rather than silently turning the header icon
// green for a dead cluster.
describe.each([
	['v8', errors8],
	['v9', errors9],
])('isUnreachableError with the %s client', (_label, errors) => {
	it.each(['ConnectionError', 'TimeoutError', 'NoLivingConnectionsError'])(
		'treats %s as unreachable',
		name => {
			expect(isUnreachableError(new errors[name]('failed', {}))).toBe(true);
		}
	);

	it('treats ResponseError as reachable', () => {
		const meta = { body: { error: { reason: 'index_not_found' } }, statusCode: 404, headers: {}, warnings: [], meta: {} };
		expect(isUnreachableError(new errors.ResponseError(meta))).toBe(false);
	});
});

describe('isUnreachableError with other values', () => {
	it('treats plain errors and nullish values as reachable', () => {
		expect(isUnreachableError(new Error('nope'))).toBe(false);
		expect(isUnreachableError(null)).toBe(false);
		expect(isUnreachableError(undefined)).toBe(false);
	});
});
