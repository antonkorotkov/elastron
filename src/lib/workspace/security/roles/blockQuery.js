import isEqual from 'lodash/isEqual.js'

/**
 * An index block's document query.
 *
 * Elasticsearch accepts a query as an object, as a JSON string, or as a
 * Mustache template, and returns all three as a string. This turns that string
 * into something the editor can show and back again, without changing a query
 * it was not asked to change.
 */

/** The forms a block's query can take. */
export const QUERY_FORM = {
	NONE: 'none',
	QUERY: 'query',
	TEMPLATE: 'template',
}

const isObject = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value)

/** Parses the string the cluster returns; anything else is passed through. */
const parse = raw => {
	if (typeof raw !== 'string') return raw
	try {
		return JSON.parse(raw)
	} catch {
		return null
	}
}

/**
 * Reads a block's query into `{ form, source }`, where `source` is the object
 * to edit: the query itself, or a template's own source rather than the
 * escaped string it is stored in.
 *
 * `raw` is kept so a query that cannot be parsed is still written back exactly
 * as it came.
 */
export const readQuery = block => {
	const raw = block?.query
	if (raw === undefined || raw === null || raw === '') {
		return { form: QUERY_FORM.NONE, source: null, raw: undefined }
	}

	const parsed = parse(raw)
	if (!isObject(parsed)) return { form: QUERY_FORM.QUERY, source: null, raw }

	if (isObject(parsed.template)) {
		// A template's source is itself JSON in a string; the editor shows that
		// inner document, not the string wrapping it.
		const inner = parse(parsed.template.source)
		const source = isObject(inner) ? inner : null
		return {
			form: QUERY_FORM.TEMPLATE,
			source,
			original: source,
			raw,
			// An id-based template has no source to show.
			unmodelled: !isObject(inner),
		}
	}

	return { form: QUERY_FORM.QUERY, source: parsed, original: parsed, raw }
}

/**
 * Turns an edited `{ form, source }` back into the value to send. Returns
 * `undefined` when there is no query, so the caller omits the field rather
 * than sending an empty one.
 */
export const writeQuery = ({ form, source, original, raw, unmodelled } = {}) => {
	if (form === QUERY_FORM.NONE) return undefined
	// Nothing the editor could show, so nothing it may rewrite.
	if (unmodelled || !isObject(source)) return raw
	// Untouched, so it goes back exactly as the cluster reported it rather than
	// re-serialised with different key order or spacing.
	if (raw !== undefined && isEqual(source, original)) return raw
	if (form === QUERY_FORM.TEMPLATE) return { template: { source: JSON.stringify(source) } }
	return source
}

/** Reads a block's field restrictions into lists the editor can bind to. */
export const readFieldSecurity = block => ({
	grant: [...(block?.field_security?.grant ?? [])],
	except: [...(block?.field_security?.except ?? [])],
})

/**
 * Turns granted and excepted fields back into what to send, or `undefined`
 * when nothing is restricted. Elasticsearch refuses `except` without `grant`,
 * so an except-only edit is reported rather than sent.
 */
export const writeFieldSecurity = ({ grant = [], except = [] } = {}) => {
	if (grant.length === 0 && except.length === 0) return undefined
	const value = {}
	if (grant.length) value.grant = grant
	if (except.length) value.except = except
	return value
}

export const EXCEPT_WITHOUT_GRANT =
	'Excepted fields need granted fields to except from. Add the fields this role may see, or clear the exceptions.'

/** Why field restrictions cannot be sent, or null when they can. */
export const refuseFieldSecurity = ({ grant = [], except = [] } = {}) =>
	except.length > 0 && grant.length === 0 ? EXCEPT_WITHOUT_GRANT : null
