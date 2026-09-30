import isEqual from 'lodash/isEqual.js'

// Elasticsearch accepts a document query as an object, a JSON string or a
// Mustache template, and returns all three as a string.


export const QUERY_FORM = {
	NONE: 'none',
	QUERY: 'query',
}

const isObject = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const parse = raw => {
	if (typeof raw !== 'string') return raw
	try {
		return JSON.parse(raw)
	} catch {
		return null
	}
}

// `source` is what the editor shows. `raw` is kept so a query it cannot show
// is written back as it came.
export const readQuery = block => {
	const raw = block?.query
	if (raw === undefined || raw === null || raw === '') {
		return { form: QUERY_FORM.NONE, source: null, raw: undefined }
	}

	const parsed = parse(raw)
	if (!isObject(parsed)) {
		return { form: QUERY_FORM.QUERY, source: null, raw, unmodelled: true }
	}

	// Templates and anything else that will not parse are kept as they are and
	// changed through the JSON view.
	if (isObject(parsed.template)) {
		return { form: QUERY_FORM.QUERY, source: null, raw, unmodelled: true }
	}

	return {
		form: QUERY_FORM.QUERY,
		originalForm: QUERY_FORM.QUERY,
		source: parsed,
		original: parsed,
		raw,
	}
}

// Returns undefined when there is no query, so the caller omits the field.
export const writeQuery = ({ form, originalForm, source, original, raw, unmodelled } = {}) => {
	if (form === QUERY_FORM.NONE) return undefined
	if (unmodelled || !isObject(source)) return raw
	// Untouched, so it goes back verbatim rather than re-serialised.
	if (raw !== undefined && form === originalForm && isEqual(source, original)) return raw
	return source
}

export const readFieldSecurity = block => ({
	grant: [...(block?.field_security?.grant ?? [])],
	except: [...(block?.field_security?.except ?? [])],
})

export const writeFieldSecurity = ({ grant = [], except = [] } = {}) => {
	if (grant.length === 0 && except.length === 0) return undefined
	const value = {}
	if (grant.length) value.grant = grant
	if (except.length) value.except = except
	return value
}

export const EXCEPT_WITHOUT_GRANT =
	'Excepted fields need granted fields to except from. Add the fields this role may see, or clear the exceptions.'

// Elasticsearch refuses `except` without `grant`.
export const refuseFieldSecurity = ({ grant = [], except = [] } = {}) =>
	except.length > 0 && grant.length === 0 ? EXCEPT_WITHOUT_GRANT : null
