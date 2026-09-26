import { getMessageFromError } from '../utils/helpers';

// Every renderer request to the cluster goes through `_request`, so it is the
// one place that knows whether the cluster answered. The store registers a
// listener here at startup; the API class itself holds no store reference.
let reachabilityListener = null;

export const setReachabilityListener = listener => {
	reachabilityListener = listener;
};

// Reports carry the connection they came from, so a request to another
// cluster, such as testing a saved connection, can be told apart.
const reportReachability = (reachable, connection) => {
	if (reachabilityListener) reachabilityListener(reachable, connection);
};

export default class API {
	constructor(connection, windowId) {
		this.connection = connection;
		this.windowId = windowId || (typeof window !== 'undefined' ? window.__elastronWindowId : null);
	}

	/**
	 * Internal request helper linking to distinct semantic endpoints
	 */
	async _request(endpoint, payload = {}) {
		const response = await fetch(`/api/elastic/${endpoint}`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				...payload,
				connection: this.connection,
				windowId: this.windowId,
			})
		});

		const result = await response.json();

		if (!response.ok || result.error) {
			// Only a network-level failure says anything about reachability. An
			// error the cluster itself returned leaves the indicator as it is.
			if (result.unreachable) reportReachability(false, this.connection);
			const errorMessage = result.error || 'Unknown server error';
			// Security routes classify their failures so the renderer can name a
			// cause instead of echoing the cluster. Other routes leave these unset.
			throw Object.assign(new Error(errorMessage), {
				cause: result.cause,
				reason: result.reason,
				unreachable: result.unreachable,
			});
		}

		reportReachability(true, this.connection);
		return { data: result.data };
	}

	formatCatJson(data) {
		if (!data || !Array.isArray(data)) return false;
		const columns = data.length > 0 ? Object.keys(data[0]) : [];
		const rows = data.map(item => columns.map(col => typeof item[col] === 'object' ? JSON.stringify(item[col]) : String(item[col] ?? '')));
		return { columns, data: rows };
	}

	async test() {
		try {
			const response = await this._request('test')
			if (response.data && response.data.tagline)
				return {
					success: true,
					message: response.data.tagline,
					...response.data,
				}
			return {
				success: false,
				message: 'Something went wrong',
			}
		} catch (err) {
			throw new ConnectionError(err)
		}
	}

	async genericRequest(payload) {
		const response = await this._request('request', payload);
		return response.data;
	}

	async getIndices() {
		try {
			const response = await this._request('indices')
			return this.formatCatJson(response.data)
		} catch (err) {
			throw new ConnectionError(err)
		}
	}

	async getAllocation() {
		try {
			const response = await this._request('allocation')
			return this.formatCatJson(response.data)
		} catch (err) {
			throw new ConnectionError(err)
		}
	}

	async getShards() {
		try {
			const response = await this._request('shards')
			return this.formatCatJson(response.data)
		} catch (err) {
			throw new ConnectionError(err)
		}
	}

	async uriSearch(params) {
		const response = await this._request('search/uri', params)
		return response.data
	}

	async bodySearch(params) {
		const response = await this._request('search/body', params)
		return response.data
	}

	async deleteDocument(index, type = '_doc', id, params = {}) {
		const response = await this._request('document/delete', { index, type, id, params })
		return response.data
	}

	async updateDocument(index, id, fields = {}) {
		try {
			const response = await this._request('document/update', { index, id, fields })
			return response.data
		} catch (err) {
			throw new ConnectionError(err)
		}
	}

	async indexDocument(index, type = '_doc', id, fields = {}) {
		const response = await this._request('document/index', { index, type, id, fields })
		return response.data
	}

	async getIndex(index) {
		try {
			const response = await this._request('index/get', { index })
			return response.data
		} catch (err) {
			throw new ConnectionError(err)
		}
	}

	async deleteIndex(index) {
		try {
			const response = await this._request('index/delete', { index })
			return response.data
		} catch (err) {
			throw new ConnectionError(err)
		}
	}

	async closeIndex(index) {
		try {
			const response = await this._request('index/close', { index })
			return response.data
		} catch (err) {
			throw new ConnectionError(err)
		}
	}

	async openIndex(index) {
		try {
			const response = await this._request('index/open', { index })
			return response.data
		} catch (err) {
			throw new ConnectionError(err)
		}
	}

	async createIndex(index, settings = {}) {
		try {
			const response = await this._request('index/create', { index, settings })
			return response.data
		} catch (err) {
			throw new ConnectionError(err)
		}
	}

	async cloneIndex(existingIndex, newIndex) {
		try {
			const response = await this._request('index/clone', { existingIndex, newIndex })
			return response.data
		} catch (err) {
			throw new ConnectionError(err)
		}
	}

	async wipeIndex(index) {
		try {
			const response = await this._request('index/wipe', { index })
			return response.data
		} catch (err) {
			throw new ConnectionError(err)
		}
	}

	async updateIndexMapping(index, mapping) {
		try {
			const response = await this._request('index/mapping', { index, mapping })
			return response.data
		} catch (err) {
			throw new ConnectionError(err)
		}
	}

	async updateIndexSettings(index, settings) {
		try {
			const response = await this._request('index/settings', { index, settings })
			return response.data
		} catch (err) {
			throw new ConnectionError(err)
		}
	}

	async deleteIndexAlias(index, alias) {
		try {
			const response = await this._request('alias/delete', { index, alias })
			return response.data
		} catch (err) {
			throw new ConnectionError(err)
		}
	}

	async createIndexAlias(index, alias, data) {
		try {
			const response = await this._request('alias/create', { index, alias, data })
			return response.data
		} catch (err) {
			throw new ConnectionError(err)
		}
	}

	async getClusterHealth() {
		try {
			const response = await this._request('cluster/health')
			return response.data
		} catch (err) {
			throw new ConnectionError(err)
		}
	}

	async getClusterStats() {
		try {
			const response = await this._request('cluster/stats')
			return response.data
		} catch (err) {
			throw new ConnectionError(err)
		}
	}

	async getNodeStats() {
		try {
			const response = await this._request('nodes/stats')
			return response.data
		} catch (err) {
			throw new ConnectionError(err)
		}
	}

	// --- Security -------------------------------------------------------
	// These deliberately do not wrap failures in ConnectionError: the cause a
	// security route attaches is what the surfaces render, and wrapping would
	// discard it.

	async whoAmI() {
		const response = await this._request('security/authenticate')
		return response.data
	}

	async getBuiltinPrivileges() {
		const response = await this._request('security/privileges')
		return response.data
	}

	async getSecurityUsers() {
		const response = await this._request('security/users')
		return response.data
	}

	async putSecurityUser(username, body) {
		const response = await this._request('security/user/put', { username, body })
		return response.data
	}

	async deleteSecurityUser(username) {
		const response = await this._request('security/user/delete', { username })
		return response.data
	}

	async setSecurityUserEnabled(username, enabled) {
		const response = await this._request('security/user/enabled', { username, enabled })
		return response.data
	}

	async changeSecurityUserPassword(username, password) {
		const response = await this._request('security/user/password', { username, password })
		return response.data
	}

	async getSecurityRoles() {
		const response = await this._request('security/roles')
		return response.data
	}

	async putSecurityRole(name, body) {
		const response = await this._request('security/role/put', { name, body })
		return response.data
	}

	async previewSecurityQuery(names, query) {
		const response = await this._request('security/query/preview', { names, query })
		return response.data
	}

	async deleteSecurityRole(name) {
		const response = await this._request('security/role/delete', { name })
		return response.data
	}

	async getSecurityApiKeys(owner = false) {
		const response = await this._request('security/api-keys', { owner })
		return response.data
	}

	async createSecurityApiKey(body) {
		const response = await this._request('security/api-key/create', { body })
		return response.data
	}

	async invalidateSecurityApiKey(id) {
		const response = await this._request('security/api-key/invalidate', { id })
		return response.data
	}
}

class ConnectionError extends Error {
	constructor(error) {
		const message = getMessageFromError(error);
		super(message)

		this.type = 'ConnectionError'
		this.message = message
	}
}

/**
 * Opens an SSH tunnel for this connection.
 * @returns {Promise<{data?: {localPort: number}, error?: string}>}
 */
export async function openTunnel(connection, windowId) {
	const response = await fetch('/api/elastic/tunnel/open', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ windowId, connection }),
	});
	return response.json();
}

/**
 * Closes the SSH tunnel for this window.
 * @returns {Promise<{data?: {closed: boolean}, error?: string}>}
 */
export async function closeTunnel(windowId) {
	const response = await fetch('/api/elastic/tunnel/close', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ windowId }),
	});
	return response.json();
}
