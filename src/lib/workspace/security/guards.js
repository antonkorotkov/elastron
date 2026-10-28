const MANAGING_PRIVILEGES = new Set(['all', 'manage_security'])
const MANAGING_RESERVED_ROLES = new Set(['superuser'])

// A role the catalogue does not describe is assumed to manage security.
// Concluding otherwise would decide the account never held a managing role and
// wave through the edit this guards against, and a failed catalogue read still
// marks the list loaded.
export const roleManagesSecurity = (name, definition) => {
	if (MANAGING_RESERVED_ROLES.has(name)) return true
	const cluster = definition?.cluster
	if (!Array.isArray(cluster)) return !definition
	return cluster.some(privilege => MANAGING_PRIVILEGES.has(privilege))
}

export const anyRoleManagesSecurity = (roleNames, catalogue) =>
	(roleNames || []).some(name => roleManagesSecurity(name, catalogue?.[name]))

export const SELF_DELETE_REFUSAL =
	'This is the account this connection signs in as. Deleting it would lock you out of the cluster from here, so Elastron will not send the request.'

export const SELF_DEMOTE_REFUSAL =
	'This is the account this connection signs in as, and the change would leave it without any role that can manage security. That would lock you out of this screen immediately, so Elastron will not send the request.'

export const isSelf = (username, identity) =>
	Boolean(username) && Boolean(identity?.username) && username === identity.username

export const refuseUserDelete = (username, identity) =>
	isSelf(username, identity) ? SELF_DELETE_REFUSAL : null

const knownToManageSecurity = (name, catalogue) =>
	Boolean(catalogue?.[name]) && roleManagesSecurity(name, catalogue[name])

// Elasticsearch refuses an account disabling itself but not an account
// stripping its own roles, which locks it out on the next request.
// Unknown roles cut both ways: one being removed may be the managing one, and
// one being kept cannot be counted on to be.
export const refuseUserRoleChange = (username, nextRoles, identity, catalogue) => {
	if (!isSelf(username, identity)) return null
	const kept = new Set(nextRoles || [])
	const dropped = (identity?.roles || []).filter(name => !kept.has(name))
	if (!anyRoleManagesSecurity(dropped, catalogue)) return null
	return [...kept].some(name => MANAGING_RESERVED_ROLES.has(name) || knownToManageSecurity(name, catalogue))
		? null
		: SELF_DEMOTE_REFUSAL
}

// --- Role mappings ---------------------------------------------------------

export const UNKNOWN = 'unknown'

const isRegex = value => typeof value === 'string' && value.length > 1 && value.startsWith('/') && value.endsWith('/')
const isWildcard = value => typeof value === 'string' && /(^|[^\\])[*?]/.test(value)

const globToRegExp = pattern => {
	let source = ''
	for (let i = 0; i < pattern.length; i++) {
		const char = pattern[i]
		if (char === '\\' && i + 1 < pattern.length) source += pattern[++i].replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
		else if (char === '*') source += '.*'
		else if (char === '?') source += '.'
		else source += char.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
	}
	return new RegExp(`^${source}$`, 's')
}

// Elasticsearch compares DNs after full LDAP normalisation. This covers case and
// spacing; a DN using escapes or multi-valued names may still be equal to one
// that looks different here, so a miss on those is not trusted.
const normaliseDn = dn => dn.toLowerCase().replace(/\s*([,=])\s*/g, '$1').trim()
const isPlainDn = dn => !/[\\+#"]/.test(dn)

const DN_FIELDS = new Set(['dn', 'groups'])

// Elasticsearch runs a wildcard pattern, as written, against the DN as given,
// normalised, lower-cased and upper-cased, and reads "*,<dn>" as any entry
// below that DN.
const matchesDnPattern = (pattern, actual) => {
	const glob = globToRegExp(pattern)
	const variants = [actual, normaliseDn(actual), actual.toLowerCase(), actual.toUpperCase()]
	if (variants.some(value => glob.test(value))) return true
	const suffix = pattern.startsWith('*,') ? pattern.slice(2) : null
	return Boolean(suffix) && !suffix.includes('*') && normaliseDn(actual).endsWith(`,${normaliseDn(suffix)}`)
}

const matchOne = (name, pattern, actual) => {
	if (isRegex(pattern)) return UNKNOWN
	if (typeof pattern !== 'string' || typeof actual !== 'string') return pattern === actual

	if (!DN_FIELDS.has(name)) return isWildcard(pattern) ? globToRegExp(pattern).test(actual) : pattern === actual

	const hit = isWildcard(pattern) ? matchesDnPattern(pattern, actual) : normaliseDn(pattern) === normaliseDn(actual)
	if (hit) return true
	return isPlainDn(pattern) && isPlainDn(actual) ? false : UNKNOWN
}

// What the cluster would see for this field, or undefined when the account's
// identity does not say. LDAP and AD accounts carry their DN and groups in
// metadata; other realms do not report them.
const subjectValue = (name, subject) => {
	if (name === 'username') return subject.username ?? undefined
	if (name === 'realm.name') return subject.realm?.name ?? undefined
	if (name === 'dn') return subject.metadata?.ldap_dn
	if (name === 'groups') return subject.metadata?.ldap_groups
	if (name.startsWith('metadata.')) {
		const key = name.slice('metadata.'.length)
		return Object.hasOwn(subject.metadata || {}, key) ? subject.metadata[key] : undefined
	}
	return undefined
}

const someOf = answers => (answers.includes(true) ? true : answers.includes(UNKNOWN) ? UNKNOWN : false)
const everyOf = answers => (answers.includes(false) ? false : answers.includes(UNKNOWN) ? UNKNOWN : true)

const evaluateField = (field, subject) => {
	const entries = Object.entries(field || {})
	if (entries.length !== 1) return UNKNOWN
	const [[name, expected]] = entries

	const actual = subjectValue(name, subject)
	if (actual === undefined) return UNKNOWN

	const patterns = Array.isArray(expected) ? expected : [expected]
	const actuals = Array.isArray(actual) ? actual : [actual]
	return someOf(patterns.flatMap(pattern => actuals.map(value => matchOne(name, pattern, value))))
}

/**
 * Whether these rules apply to the account the connection signs in as: true,
 * false, or UNKNOWN when they depend on something its identity does not show.
 */
export const evaluateRules = (rules, subject) => {
	if (!rules || typeof rules !== 'object') return UNKNOWN
	if (rules.field) return evaluateField(rules.field, subject)
	if (rules.except) {
		const inner = evaluateRules(rules.except, subject)
		return inner === UNKNOWN ? UNKNOWN : !inner
	}
	if (Array.isArray(rules.all)) return everyOf(rules.all.map(rule => evaluateRules(rule, subject)))
	if (Array.isArray(rules.any)) return someOf(rules.any.map(rule => evaluateRules(rule, subject)))
	return UNKNOWN
}

// Roles from these realms are their own; role mappings never decide them.
const UNMAPPED_REALMS = new Set(['native', 'file', 'reserved'])

// A token keeps the roles its user had when it was issued, so a mapping change
// locks that user out at their next sign-in rather than at once.
const MAPPED_AUTHENTICATIONS = new Set(['realm', 'token'])

export const rolesComeFromMappings = identity =>
	MAPPED_AUTHENTICATIONS.has(identity?.authenticationType) &&
	Boolean(identity?.realm?.type) &&
	!UNMAPPED_REALMS.has(identity.realm.type)

const isEnabled = mapping => Boolean(mapping) && mapping.enabled !== false

// Templates name their roles only when the cluster renders them for a user.
const grantsManagingRole = (mapping, catalogue) => {
	if (Array.isArray(mapping?.role_templates)) return UNKNOWN
	const roles = mapping?.roles || []
	if (roles.some(name => MANAGING_RESERVED_ROLES.has(name) || knownToManageSecurity(name, catalogue))) return true
	return roles.some(name => !catalogue?.[name]) ? UNKNOWN : false
}

const keepsManagingRole = (mapping, identity, catalogue) =>
	isEnabled(mapping) &&
	evaluateRules(mapping.rules, identity) === true &&
	grantsManagingRole(mapping, catalogue) === true

// Mappings in the realms' role mapping files are not returned by the API. A
// managing role the account holds that no mapping in view could have granted
// comes from one of those, or from the realm itself, and outlasts this change.
const heldFromElsewhere = (mappings, identity, catalogue) => {
	const visible = mappings.filter(m => isEnabled(m) && evaluateRules(m.rules, identity) !== false)
	if (visible.some(m => Array.isArray(m.role_templates))) return false
	const granted = new Set(visible.flatMap(m => m.roles || []))
	return (identity?.roles || []).some(
		name => !granted.has(name) && (MANAGING_RESERVED_ROLES.has(name) || knownToManageSecurity(name, catalogue))
	)
}

export const MAPPING_LOCKOUT_REFUSAL =
	'This mapping is what gives the account this connection signs in as a role that can manage security. Without it you would be locked out of this screen, so Elastron will not send the request.'

export const MAPPING_LOCKOUT_WARNING =
	'This mapping grants a role that can manage security, and Elastron cannot tell whether it is what gives the account this connection signs in as that role. If it is, this change will lock you out of this screen.'

/**
 * Judges a change to one mapping: `before` as the cluster holds it, `after` as
 * it would be (null for a delete), and the cluster's other mappings. Returns
 * null to allow, or a refusal or warning for the account the connection signs
 * in as.
 */
export const refuseMappingChange = (before, after, others, identity, catalogue) => {
	if (!rolesComeFromMappings(identity) || !isEnabled(before)) return null

	const granted = grantsManagingRole(before, catalogue)
	if (granted === false) return null
	const applies = evaluateRules(before.rules, identity)
	if (applies === false) return null

	if (keepsManagingRole(after, identity, catalogue)) return null
	if ((others || []).some(mapping => keepsManagingRole(mapping, identity, catalogue))) return null
	if (heldFromElsewhere([before, ...(others || [])], identity, catalogue)) return null

	return granted === true && applies === true
		? { level: 'refuse', message: MAPPING_LOCKOUT_REFUSAL }
		: { level: 'confirm', message: MAPPING_LOCKOUT_WARNING }
}
