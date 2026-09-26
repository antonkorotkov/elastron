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

// Elasticsearch refuses an account disabling itself but not an account
// stripping its own roles, which locks it out on the next request.
export const refuseUserRoleChange = (username, nextRoles, identity, catalogue) => {
	if (!isSelf(username, identity)) return null
	if (!anyRoleManagesSecurity(identity?.roles, catalogue)) return null
	return anyRoleManagesSecurity(nextRoles, catalogue) ? null : SELF_DEMOTE_REFUSAL
}
