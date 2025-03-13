import { default as axios } from "axios"
import { Agent } from "https"
import get from "lodash/get.js"

/**
 * @param {*} connection
 */
const buildConnectionHeaders = connection => {
	const { useAuth, user, password, addHeaders, headers } = connection

	let headersObject = {}

	if (useAuth) {
		headersObject.Authorization = `Basic ${btoa(`${user}:${password}`)}`
	}

	if (addHeaders && headers.length) {
		for (const header of headers) {
			headersObject[header.name] = header.value
		}
	}

	return headersObject
}

/**
 *
 * @param {*} connection
 */
const buildConnectionUrl = connection => {
	const { host, port } = connection
	return `${host.replace(/\/+$/, '')}${Number(port) > 0 ? `:${port}` : ''}`
}

const init = messaging => {
	let client;

	messaging.respond('elastic-request-client-init', (__, connection) => {
		client = axios.create({
			baseURL: buildConnectionUrl(connection),
			headers: buildConnectionHeaders(connection),
			httpsAgent: new Agent({
				rejectUnauthorized: false
			})
		})
	});

	messaging.respond('elastic-request', async (__, method, ...args) => {
		try {
			const response = await client[method](...args);
			const { data } = response;
			return { data };
		} catch (err) {
			const message = get(
				err,
				'response.data.error.root_cause[0].reason',
				get(err, 'response.data.error.reason', err.message)
			)
			throw new Error(message);
		}
	})
}

export default { init }
