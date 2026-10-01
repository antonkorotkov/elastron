export const NOT_JSON = Symbol('not json')

const isObject = body => body !== null && typeof body === 'object'

export const pickResponseView = ({ body, contentType = '' }) =>
	contentType.includes('json') || isObject(body) ? 'json' : 'raw'

export const toRawText = body => {
	if (typeof body === 'string') return body
	if (isObject(body)) return JSON.stringify(body, null, 2)
	return String(body)
}

export const toJsonValue = body => {
	if (isObject(body)) return body
	if (typeof body !== 'string') return NOT_JSON
	try {
		const parsed = JSON.parse(body)
		return isObject(parsed) ? parsed : NOT_JSON
	} catch {
		return NOT_JSON
	}
}

export const statusClass = statusCode => {
	if (statusCode >= 500) return 'server-error'
	if (statusCode >= 400) return 'client-error'
	return 'success'
}
