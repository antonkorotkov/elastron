import { LIST_PAGE_SIZE } from '../../../ai/catalog.js'

/** The most rows (search hits, list entries, a page) any tool result carries. */
export const RESULT_ROW_LIMIT = LIST_PAGE_SIZE

/** The most characters of JSON any tool result carries. */
export const RESULT_CHAR_LIMIT = 20000

/** Reduces a requested row count to the ceiling. */
export const clampSize = size =>
	Number.isFinite(size) ? Math.min(Math.max(Math.trunc(size), 0), RESULT_ROW_LIMIT) : size

/** Cuts a list response to the row ceiling, marking it when cut. */
export const capRows = rows => {
	const list = Array.isArray(rows) ? rows : []
	if (list.length <= RESULT_ROW_LIMIT) return { total: list.length, rows: list }
	return {
		total: list.length,
		returned: RESULT_ROW_LIMIT,
		truncated: true,
		note: `Showing the first ${RESULT_ROW_LIMIT} of ${list.length} entries.`,
		rows: list.slice(0, RESULT_ROW_LIMIT),
	}
}

/**
 * The last guard on every tool result: anything whose JSON exceeds the
 * character ceiling is replaced by a marked, cut-down preview.
 */
export const capSize = value => {
	const json = JSON.stringify(value)
	if (json === undefined || json.length <= RESULT_CHAR_LIMIT) return value
	return {
		truncated: true,
		note: `The result was ${json.length} characters; showing the first ${RESULT_CHAR_LIMIT}. Narrow the request to see the rest.`,
		preview: json.slice(0, RESULT_CHAR_LIMIT),
	}
}

/**
 * One page of a full list. Pages after the last come back empty with a note.
 * Every page but the last is marked truncated and says how to get the next.
 */
export const pageRows = (rows, page = 1) => {
	const list = Array.isArray(rows) ? rows : []
	const pages = Math.max(1, Math.ceil(list.length / RESULT_ROW_LIMIT))
	const start = (page - 1) * RESULT_ROW_LIMIT
	const slice = list.slice(start, start + RESULT_ROW_LIMIT)
	const result = { total: list.length, page, pages, returned: slice.length, rows: slice }
	if (page > pages) {
		result.note = `There ${pages === 1 ? 'is only 1 page' : `are only ${pages} pages`}.`
	} else if (page < pages) {
		result.truncated = true
		result.note = `Showing entries ${start + 1}–${start + slice.length} of ${list.length} (page ${page} of ${pages}). Request page ${page + 1} for more; the user must approve each further page.`
	}
	return result
}
