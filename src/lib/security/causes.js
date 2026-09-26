// Maps a cluster refusal to a cause the user can act on. Outside $lib/server
// because a route classifies and the renderer switches on the result.

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

// A cluster with security disabled does not say so: the user list answers
// "Incorrect HTTP method ... allowed: [POST]" and _has_privileges answers
// "no handler found".
const isSecurityDisabled = reason =>
	/no handler found for uri \[\/?_security/i.test(reason) ||
	/incorrect http method for uri \[\/?_security/i.test(reason);

const isLicense = reason => /non-compliant|license|licence/i.test(reason);

const isReserved = reason => /\breserved\b/i.test(reason);


export const classifySecurityError = err => {
	if (!err) return CAUSE.UNKNOWN;

	// The renderer has no status or reason to work from, so a cause a route
	// already attached is trusted. `cause` is a standard Error property, so
	// only known values count.
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

	if (isLicense(reason)) return CAUSE.LICENSE;
	if (status === 400 && isReserved(reason)) return CAUSE.RESERVED;
	if (status === 403) return CAUSE.PRIVILEGE;

	return CAUSE.UNKNOWN;
};

export const messageForCause = cause => MESSAGES[cause] || MESSAGES[CAUSE.UNKNOWN];

// `reason` is the cluster's wording, shown as detail, never as the message.
export const describeSecurityFailure = err => {
	const cause = classifySecurityError(err);
	return { cause, message: messageForCause(cause), reason: reasonOf(err) || undefined };
};
