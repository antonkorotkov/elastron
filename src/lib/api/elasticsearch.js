import { getMessageFromError } from '../utils/helpers';

export default class API {
	constructor(connection) {
		this.connection = connection;
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
				connection: this.connection
			})
		});

		const result = await response.json();

		if (!response.ok || result.error) {
			const errorMessage = result.error || 'Unknown server error';
			throw new Error(errorMessage);
		}

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
}

class ConnectionError extends Error {
	constructor(error) {
		const message = getMessageFromError(error);
		super(message)

		this.type = 'ConnectionError'
		this.message = message
	}
}
