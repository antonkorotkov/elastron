import { describe, it, expect } from 'vitest';
import { CAUSE, classifySecurityError, describeSecurityFailure, messageForCause } from './causes';

// Every string below was captured verbatim from a running cluster during the
// investigation recorded in design.md, so a change in Elasticsearch's wording
// fails here rather than silently degrading to the unknown cause.
const structured = (status, type, reason) => ({
	meta: { statusCode: status, body: { error: { type, reason, root_cause: [{ type, reason }] } } },
});

// A cluster with security disabled answers with a bare string body.
const bareString = (status, error) => ({ meta: { statusCode: status, body: { error } } });

describe('classifySecurityError', () => {
	it('recognises a cluster with security disabled from the no-handler reply', () => {
		const err = bareString(400, 'no handler found for uri [/_security/user/_has_privileges] and method [POST]');
		expect(classifySecurityError(err)).toBe(CAUSE.SECURITY_DISABLED);
	});

	it('recognises a cluster with security disabled from the misleading method reply', () => {
		const err = bareString(405, 'Incorrect HTTP method for uri [/_security/user] and method [GET], allowed: [POST]');
		expect(classifySecurityError(err)).toBe(CAUSE.SECURITY_DISABLED);
	});

	it('tells a licence refusal apart from a permission refusal', () => {
		const err = structured(403, 'security_exception', 'current license is non-compliant for [field and document level security]');
		expect(classifySecurityError(err)).toBe(CAUSE.LICENSE);
	});

	it('reads an unauthorized action as a missing privilege', () => {
		const err = structured(403, 'security_exception', 'action [cluster:admin/xpack/security/user/put] is unauthorized for user [probe_ok]');
		expect(classifySecurityError(err)).toBe(CAUSE.PRIVILEGE);
	});

	it.each([
		'Validation Failed: 1: Role [superuser] is reserved and may not be used.;',
		'role [superuser] is reserved and cannot be deleted',
		'user [elastic] is reserved and cannot be deleted',
		'Validation Failed: 1: user [elastic] is reserved and only the password can be changed;',
	])('recognises a reserved entity from %j', reason => {
		expect(classifySecurityError(structured(400, 'action_request_validation_exception', reason))).toBe(CAUSE.RESERVED);
	});

	it('reads a rejected credential as such', () => {
		const err = structured(401, 'security_exception', 'missing authentication credentials for REST request [/]');
		expect(classifySecurityError(err)).toBe(CAUSE.CREDENTIALS);
	});

	it('passes an unreachable cluster through as unreachable', () => {
		expect(classifySecurityError({ unreachable: true })).toBe(CAUSE.UNREACHABLE);
		expect(classifySecurityError({ name: 'TunnelNotOpenError' })).toBe(CAUSE.UNREACHABLE);
	});

	it('falls back to unknown rather than guessing', () => {
		expect(classifySecurityError(structured(500, 'illegal_state_exception', 'something else entirely'))).toBe(CAUSE.UNKNOWN);
		expect(classifySecurityError(null)).toBe(CAUSE.UNKNOWN);
	});

	it('classifies the flattened shape the renderer receives from a route', () => {
		expect(classifySecurityError({ status: 403, reason: 'current license is non-compliant for [field and document level security]' })).toBe(CAUSE.LICENSE);
	});
});

describe('describeSecurityFailure', () => {
	it('never uses the cluster wording as the message', () => {
		const raw = 'Incorrect HTTP method for uri [/_security/user] and method [GET], allowed: [POST]';
		const described = describeSecurityFailure(bareString(405, raw));

		expect(described.cause).toBe(CAUSE.SECURITY_DISABLED);
		expect(described.message).not.toContain('Incorrect HTTP method');
		expect(described.message).toContain('Security is not enabled');
		expect(described.reason).toBe(raw);
	});

	it('gives every cause a distinct sentence', () => {
		const seen = Object.values(CAUSE).map(messageForCause);
		expect(new Set(seen).size).toBe(seen.length);
	});
});

describe('a cause carried back from a route', () => {
	it('is trusted rather than re-derived, since the renderer has no status to work from', () => {
		const fromClient = Object.assign(new Error('refused'), { cause: CAUSE.PRIVILEGE });
		expect(classifySecurityError(fromClient)).toBe(CAUSE.PRIVILEGE);
	});

	it('ignores a cause that is not one of ours', () => {
		const err = Object.assign(new Error('boom'), { cause: new Error('underlying') });
		expect(classifySecurityError(err)).toBe(CAUSE.UNKNOWN);
	});
});
