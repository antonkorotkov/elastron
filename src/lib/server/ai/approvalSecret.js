import { randomBytes } from 'node:crypto'

// Kept on globalThis so a dev-server module reload doesn't invalidate
// approvals already on screen. A real app restart does, by design.
const KEY = Symbol.for('elastron.toolApprovalSecret')

/**
 * The secret the SDK uses to sign tool approvals, generated once per server
 * process. It never leaves the server; only signatures reach the renderer.
 */
export const getToolApprovalSecret = () => {
	globalThis[KEY] ??= randomBytes(32).toString('base64url')
	return globalThis[KEY]
}
