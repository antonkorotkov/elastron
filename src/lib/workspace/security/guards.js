/**
 * Refusals the app makes on its own behalf, before anything is sent.
 *
 * Elasticsearch guards one of these and not the others. It refuses to let an
 * account disable itself, reporting "users may not update the enabled status
 * of their own account". It does not refuse an account stripping its own
 * roles: during the investigation recorded in design.md a native superuser
 * removed its own roles using its own credentials, the cluster answered 200,
 * and the next request from that account was refused. The lockout was
 * immediate and not recoverable from inside the app.
 */

/** Cluster privileges that carry the ability to manage security. */
const MANAGING_PRIVILEGES = new Set(['all', 'manage_security'])

/** Reserved roles known to carry it without listing it explicitly. */
const MANAGING_RESERVED_ROLES = new Set(['superuser'])

/**
 * Whether a role grants management of security.
 * `definition` is the role as the cluster reports it; an unknown role is
 * treated as not managing, which errs toward refusing the edit.
 */
export const roleManagesSecurity = (name, definition) => {
	if (MANAGING_RESERVED_ROLES.has(name)) return true
	const cluster = definition?.cluster
	if (!Array.isArray(cluster)) return false
	return cluster.some(privilege => MANAGING_PRIVILEGES.has(privilege))
}

/** Whether any of `roleNames` grants management of security. */
export const anyRoleManagesSecurity = (roleNames, catalogue) =>
	(roleNames || []).some(name => roleManagesSecurity(name, catalogue?.[name]))

export const SELF_DELETE_REFUSAL =
	'This is the account this connection signs in as. Deleting it would lock you out of the cluster from here, so Elastron will not send the request.'

export const SELF_DEMOTE_REFUSAL =
	'This is the account this connection signs in as, and the change would leave it without any role that can manage security. That would lock you out of this screen immediately, so Elastron will not send the request.'

/** True when `username` is the account the active connection signs in as. */
export const isSelf = (username, identity) =>
	Boolean(username) && Boolean(identity?.username) && username === identity.username

/**
 * Why a delete must not be sent, or null when it may be.
 */
export const refuseUserDelete = (username, identity) =>
	isSelf(username, identity) ? SELF_DELETE_REFUSAL : null

/**
 * Why a role change must not be sent, or null when it may be.
 *
 * Only a change that takes the last managing role away from the connected
 * account is refused. Editing anyone else, or an edit that leaves a managing
 * role in place, goes through untouched.
 */
export const refuseUserRoleChange = (username, nextRoles, identity, catalogue) => {
	if (!isSelf(username, identity)) return null

	const heldBefore = anyRoleManagesSecurity(identity?.roles, catalogue)
	if (!heldBefore) return null

	return anyRoleManagesSecurity(nextRoles, catalogue) ? null : SELF_DEMOTE_REFUSAL
}
