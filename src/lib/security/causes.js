/**
 * Elastron does not probe the cluster for whether security is enabled, what
 * the licence covers, or what the account may do. It attempts the operation
 * and, when the cluster refuses, names the likely cause. This module is that
 * mapping: a cluster error in, one cause out.
 *
 * See openspec/changes/add-security-management/design.md for why this replaces
 * a capability probe, and for the observed error strings each row matches.
 *
 * This lives outside `$lib/server` on purpose. Both sides need it: a route
 * classifies the failure, and the renderer switches on the result to choose
 * what to show. It has no dependencies, so importing it into the browser
 * bundle pulls in no server code.
 */

/** Stable identifiers the renderer switches on. */
export const CAUSE = {
	SECURITY_DISABLED: 'security-disabled',
	LICENSE: 'license',
	PRIVILEGE: 'privilege',
	RESERVED: 'reserved',
	CREDENTIALS: 'credentials',
	UNREACHABLE: 'unreachable',
	UNKNOWN: 'unknown',
};

const KNOWN_CAUSES = new Set(Object.values(CAUSE));

/** What the user is told for each cause. */
const MESSAGES = {
	[CAUSE.SECURITY_DISABLED]:
		'Security is not enabled on this cluster, so users, roles, and API keys cannot be managed.',
	[CAUSE.LICENSE]:
		"This feature is not available because the cluster's licence does not cover it.",
	[CAUSE.PRIVILEGE]:
		'This is not available because your account does not have the required privilege on this cluster.',
	[CAUSE.RESERVED]:
		'This entry is reserved by Elasticsearch and cannot be changed this way.',
	[CAUSE.CREDENTIALS]:
		"This connection's credentials were rejected by the cluster.",
	[CAUSE.UNREACHABLE]: 'The cluster could not be reached.',
	[CAUSE.UNKNOWN]: 'This is not available. The cluster refused the request.',
};

const statusOf = err => err?.meta?.statusCode ?? err?.statusCode;

const reasonOf = err =>
	err?.meta?.body?.error?.root_cause?.[0]?.reason ||
	err?.meta?.body?.error?.reason ||
	// A cluster with security disabled answers with a bare string body rather
	// than the usual structured error.
	(typeof err?.meta?.body?.error === 'string' ? err.meta.body.error : '') ||
	err?.message ||
	'';

const typeOf = err =>
	err?.meta?.body?.error?.root_cause?.[0]?.type || err?.meta?.body?.error?.type || '';

/**
 * A cluster running with `xpack.security.enabled: false` does not register the
 * security REST handlers. It does not say so: a GET of the user list comes
 * back as `Incorrect HTTP method ... allowed: [POST]`, which is actively
 * misleading, and `_has_privileges` comes back as `no handler found`. Both are
 * recognised here so neither string ever reaches the user.
 */
const isSecurityDisabled = reason =>
	/no handler found for uri \[\/?_security/i.test(reason) ||
	/incorrect http method for uri \[\/?_security/i.test(reason);

const isLicense = reason => /non-compliant|license|licence/i.test(reason);

const isReserved = reason => /\breserved\b/i.test(reason);

/**
 * Classifies a cluster failure. `err` is an Elasticsearch client error; a
 * plain object carrying `status` and `reason` also works, which is what the
 * renderer passes back from a route response.
 */
export const classifySecurityError = err => {
	if (!err) return CAUSE.UNKNOWN;

	// A route classifies the failure and the API client carries that verdict
	// back on the thrown error. The renderer has neither the status nor the
	// cluster's reason to work from, so an already-classified cause is trusted
	// rather than re-derived. Only known values are honoured: `cause` is also a
	// standard Error property and may hold anything.
	if (KNOWN_CAUSES.has(err.cause)) return err.cause;

	if (err.unreachable || err.name === 'TunnelNotOpenError') return CAUSE.UNREACHABLE;

	const status = statusOf(err) ?? err.status;
	const reason = reasonOf(err) || err.reason || '';
	const type = typeOf(err);

	if (isSecurityDisabled(reason)) return CAUSE.SECURITY_DISABLED;
	if (status === 401) return CAUSE.CREDENTIALS;

	if (status === 403 && (type === 'security_exception' || !type)) {
		return isLicense(reason) ? CAUSE.LICENSE : CAUSE.PRIVILEGE;
	}

	// A licence refusal is always 403 today, but the check does not depend on
	// the status so a future status change still lands on the right cause.
	if (isLicense(reason)) return CAUSE.LICENSE;
	if (status === 400 && isReserved(reason)) return CAUSE.RESERVED;
	if (status === 403) return CAUSE.PRIVILEGE;

	return CAUSE.UNKNOWN;
};

/** The sentence shown for a cause. */
export const messageForCause = cause => MESSAGES[cause] || MESSAGES[CAUSE.UNKNOWN];

/**
 * The shape a route attaches to a failed security response. `reason` carries
 * the cluster's own wording so it can be shown as supporting detail, never as
 * the primary message.
 */
export const describeSecurityFailure = err => {
	const cause = classifySecurityError(err);
	return { cause, message: messageForCause(cause), reason: reasonOf(err) || undefined };
};
