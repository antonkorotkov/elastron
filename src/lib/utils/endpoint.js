/**
 * Identifies the cluster a connection reaches: host, port, and user, plus
 * the SSH tunnel's host, port, and user when one is used. Two profiles that
 * reach the same remote host:port through different bastions are different
 * clusters. Renaming or recoloring a profile keeps its identity.
 */
export const endpointOf = connection => {
	if (!connection?.host) return null
	const host = String(connection.host).trim().toLowerCase().replace(/\/+$/, '')
	const port = String(connection.port ?? '').trim()
	const user = connection.useAuth ? String(connection.user ?? '').trim() : ''
	const base = `${host}|${port}|${user}`
	if (!connection.useSshTunnel) return base
	const ssh = connection.ssh ?? {}
	const sshHost = String(ssh.host ?? '').trim().toLowerCase()
	const sshPort = String(ssh.port ?? '').trim()
	const sshUser = String(ssh.username ?? '').trim()
	return `${base}|ssh:${sshUser}@${sshHost}:${sshPort}`
}
