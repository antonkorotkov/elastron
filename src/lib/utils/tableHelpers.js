import get from 'lodash/get'

/**
 * Metadata fields the table renders specially and offers in the field picker,
 * in the order they appear there.
 */
export const META_FIELDS = ['_id', '_index', '_score', '_source']

/**
 * Field types Elasticsearch can sort on directly. Anything outside this set
 * needs a sortable multi-field (typically `<field>.keyword`) to be sorted.
 */
const SORTABLE_TYPES = new Set([
	'boolean',
	'byte',
	'constant_keyword',
	'date',
	'date_nanos',
	'double',
	'float',
	'half_float',
	'integer',
	'ip',
	'keyword',
	'long',
	'scaled_float',
	'short',
	'token_count',
	'unsigned_long',
	'version',
	'wildcard',
])

/** Cells are ellipsized by CSS; this only stops a huge value reaching the DOM. */
export const CELL_MAX_CHARS = 512

/** Upper bound for the full value shown in a cell's tooltip. */
export const TITLE_MAX_CHARS = 2000

/** Rows rendered at most, regardless of how many hits the query returned. */
export const MAX_RENDERED_ROWS = 500

/** Saved per-index layouts kept before the least recently touched is dropped. */
export const MAX_TABLE_CONFIGS = 100

export const MIN_COLUMN_WIDTH = 60
export const MAX_COLUMN_WIDTH = 1600

/**
 * Flattens Elasticsearch mapping properties into dotted field paths.
 *
 * Multi-fields (`fields`) are deliberately not included: they render
 * identically to their parent and would double the length of the picker.
 * `buildFieldIndex` records them separately so sorting can still use them.
 *
 * @param {object} properties
 * @param {string} prefix
 * @returns {string[]}
 */
export const flattenProperties = (properties, prefix = '') => {
	let fields = []
	if (!properties || typeof properties !== 'object') return fields

	for (const [key, value] of Object.entries(properties)) {
		const fullPath = prefix ? `${prefix}.${key}` : key
		if (value && typeof value === 'object' && value.properties) {
			fields.push(fullPath)
			fields.push(...flattenProperties(value.properties, fullPath))
		} else {
			fields.push(fullPath)
		}
	}
	return fields
}

/**
 * Flattens a document source object into dotted field paths.
 * @param {object} obj
 * @param {string} prefix
 * @returns {string[]}
 */
export const flattenObject = (obj, prefix = '') => {
	let fields = []
	if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return fields

	for (const [key, value] of Object.entries(obj)) {
		const fullPath = prefix ? `${prefix}.${key}` : key
		if (value && typeof value === 'object' && !Array.isArray(value)) {
			fields.push(fullPath)
			fields.push(...flattenObject(value, fullPath))
		} else {
			fields.push(fullPath)
		}
	}
	return fields
}

/**
 * Compiles a list of unique available fields from both index mappings and search results hits.
 * @param {object} indexInfo
 * @param {object[]} hits
 * @returns {string[]}
 */
export const getAvailableFields = (indexInfo, hits) => {
	const fields = new Set()

	// 1. Extract from index mappings
	if (indexInfo && typeof indexInfo === 'object') {
		for (const indexKey of Object.keys(indexInfo)) {
			const mappings = indexInfo[indexKey]?.mappings
			if (mappings) {
				const properties = mappings.properties || mappings._doc?.properties
				if (properties) {
					const flattened = flattenProperties(properties)
					for (const f of flattened) {
						fields.add(f)
					}
				}
			}
		}
	}

	// 2. Extract from search results hits
	if (Array.isArray(hits)) {
		for (const hit of hits) {
			if (hit._source) {
				const flattened = flattenObject(hit._source)
				for (const f of flattened) {
					fields.add(f)
				}
			}
		}
	}

	return Array.from(fields).sort()
}

const collectTypes = (properties, prefix, types, multiFields) => {
	if (!properties || typeof properties !== 'object') return

	for (const [key, value] of Object.entries(properties)) {
		if (!value || typeof value !== 'object') continue

		const path = prefix ? `${prefix}.${key}` : key

		if (value.properties) {
			types[path] = 'object'
			collectTypes(value.properties, path, types, multiFields)
		} else {
			types[path] = value.type || 'object'
		}

		// Multi-fields live alongside `type`, not under `properties`. They are
		// tracked separately because a nested property looks identical by path
		// but is not a sortable alternative for its parent.
		if (value.fields && typeof value.fields === 'object') {
			const subPaths = multiFields[path] ?? (multiFields[path] = [])
			for (const [subKey, subValue] of Object.entries(value.fields)) {
				if (!subValue || typeof subValue !== 'object') continue
				const subPath = `${path}.${subKey}`
				types[subPath] = subValue.type || 'object'
				subPaths.push(subPath)
			}
		}
	}
}

/**
 * Builds a lookup of field type and sort target from a `GET /{index}` response,
 * merging every index the pattern resolved to.
 *
 * `sortTargets[field]` is the field Elasticsearch should actually sort on: the
 * field itself when its type is sortable, a sortable multi-field such as
 * `title.keyword` when one exists, or null when the field cannot be sorted.
 *
 * @param {object} indexInfo
 * @returns {{ types: Record<string, string>, sortTargets: Record<string, string|null> } | null}
 */
export const buildFieldIndex = indexInfo => {
	if (!indexInfo || typeof indexInfo !== 'object') return null

	const types = {}
	const multiFields = {}
	for (const indexKey of Object.keys(indexInfo)) {
		const mappings = indexInfo[indexKey]?.mappings
		if (!mappings) continue
		collectTypes(
			mappings.properties || mappings._doc?.properties,
			'',
			types,
			multiFields
		)
	}

	if (!Object.keys(types).length) return null

	const sortTargets = {}
	for (const [path, type] of Object.entries(types)) {
		if (SORTABLE_TYPES.has(type)) {
			sortTargets[path] = path
			continue
		}

		// Prefer a `.keyword` multi-field, then any other sortable one.
		const candidates = (multiFields[path] ?? []).filter(candidate =>
			SORTABLE_TYPES.has(types[candidate])
		)
		sortTargets[path] =
			candidates.find(candidate => candidate === `${path}.keyword`) ??
			candidates[0] ??
			null
	}

	return { types, sortTargets }
}

/**
 * Resolves the field Elasticsearch should sort on for a column, or null when
 * the column cannot be sorted.
 *
 * A field the mapping does not describe returns itself: the mapping may be
 * unavailable (`_all`) or the field dynamic, and letting the cluster reject it
 * is better than refusing a sort that would have worked.
 *
 * @param {string} field
 * @param {object|null} fieldIndex
 * @returns {string|null}
 */
export const resolveSortTarget = (field, fieldIndex) => {
	// `_id` needs fielddata and is rejected by ES 8+; `_source` is not indexed.
	if (field === '_id' || field === '_source') return null
	if (field === '_index' || field === '_score') return field
	if (!fieldIndex || !(field in fieldIndex.types)) return field || null
	return fieldIndex.sortTargets[field] ?? null
}

/**
 * @param {string} field
 * @param {object|null} fieldIndex
 * @returns {boolean}
 */
export const isSortable = (field, fieldIndex) =>
	resolveSortTarget(field, fieldIndex) !== null

/**
 * Parses the URI search `sort` parameter (`field:asc,other:desc`), which the
 * table drives through its first entry.
 *
 * @param {string} sort
 * @returns {{ field: string, direction: 'asc'|'desc' } | null}
 */
export const parseUriSort = sort => {
	const first = String(sort ?? '')
		.split(',')[0]
		.trim()
	if (!first) return null

	const separator = first.lastIndexOf(':')
	const field = separator === -1 ? first : first.slice(0, separator).trim()
	const direction = separator === -1 ? '' : first.slice(separator + 1).trim()
	if (!field) return null

	return { field, direction: direction.toLowerCase() === 'desc' ? 'desc' : 'asc' }
}

/**
 * @param {string} field
 * @param {'asc'|'desc'} direction
 * @returns {string}
 */
export const buildUriSort = (field, direction) => `${field}:${direction}`

/**
 * Parses the first entry of a request body `sort`, which accepts a bare string,
 * `{ field: 'desc' }`, `{ field: { order: 'desc' } }`, or an array of those.
 *
 * @param {any} sort
 * @returns {{ field: string, direction: 'asc'|'desc' } | null}
 */
export const parseBodySort = sort => {
	const first = Array.isArray(sort) ? sort[0] : sort
	if (!first) return null

	if (typeof first === 'string') {
		return parseUriSort(first)
	}

	if (typeof first === 'object') {
		const [field, value] = Object.entries(first)[0] ?? []
		if (!field) return null
		const order = typeof value === 'string' ? value : value?.order
		return {
			field,
			direction: String(order ?? '').toLowerCase() === 'desc' ? 'desc' : 'asc',
		}
	}

	return null
}

/**
 * @param {string} field
 * @param {'asc'|'desc'} direction
 * @returns {object[]}
 */
export const buildBodySort = (field, direction) => [
	{ [field]: { order: direction } },
]

/**
 * Reads the active sort out of search state, so the header arrow and the Sort
 * input can never disagree.
 *
 * @param {object} search
 * @returns {{ field: string, direction: 'asc'|'desc' } | null}
 */
export const currentSortState = search => {
	if (!search) return null
	return search.type === 'body'
		? parseBodySort(search.requestBody?.sort)
		: parseUriSort(search.sort)
}

/** @returns {{ field: string, name: string }[]} */
export const defaultColumns = () => [
	{ field: '_id', name: '_id' },
	{ field: '_source', name: '_source' },
]

/**
 * Discards anything that is not a usable column, so a hand-edited or outdated
 * `electron-store` entry cannot break the table.
 *
 * @param {any} raw
 * @returns {{ field: string, name: string, width?: number }[]}
 */
export const sanitizeColumns = raw => {
	if (!Array.isArray(raw)) return []

	const seen = new Set()
	const columns = []

	for (const entry of raw) {
		if (!entry || typeof entry !== 'object') continue
		const field = typeof entry.field === 'string' ? entry.field.trim() : ''
		if (!field || seen.has(field)) continue
		seen.add(field)

		const column = {
			field,
			name:
				typeof entry.name === 'string' && entry.name.trim()
					? entry.name.trim()
					: field,
		}
		if (Number.isFinite(entry.width)) {
			column.width = clampColumnWidth(entry.width)
		}
		columns.push(column)
	}

	return columns
}

/**
 * @param {any} raw hydrated `tableConfigs` storage value
 * @returns {Record<string, { columns: object[] }>}
 */
export const sanitizeTableConfigs = raw => {
	if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}

	const configs = {}
	for (const [index, config] of Object.entries(raw)) {
		if (!index) continue
		const columns = sanitizeColumns(config?.columns)
		if (columns.length) configs[index] = { columns }
	}
	return configs
}

/**
 * Caps how many layouts are persisted, dropping the least recently touched.
 * `keepKey` is the layout that was just written, so it always survives.
 *
 * @param {Record<string, object>} configs
 * @param {string} keepKey
 * @returns {Record<string, object>}
 */
export const pruneTableConfigs = (configs, keepKey) => {
	const keys = Object.keys(configs)
	if (keys.length <= MAX_TABLE_CONFIGS) return configs

	const dropCount = keys.length - MAX_TABLE_CONFIGS
	const dropped = new Set(
		keys.filter(key => key !== keepKey).slice(0, dropCount)
	)

	const pruned = {}
	for (const key of keys) {
		if (!dropped.has(key)) pruned[key] = configs[key]
	}
	return pruned
}

/**
 * The columns to render. An index with no saved layout falls back to the
 * defaults without ever persisting them, so "unconfigured" stays a real state.
 *
 * @param {object|null} config
 * @returns {{ field: string, name: string, width?: number }[]}
 */
export const columnsOf = config => {
	const columns = sanitizeColumns(config?.columns)
	return columns.length ? columns : defaultColumns()
}

/** @param {object|null} config */
export const isConfigured = config => sanitizeColumns(config?.columns).length > 0

/**
 * Adds a field as a column. From an unconfigured layout the defaults are
 * replaced outright rather than appended to — otherwise every index would start
 * you with a `_source` column to remove by hand.
 *
 * @param {object[]} columns
 * @param {string} field
 * @param {boolean} configured whether `columns` came from a saved layout
 * @returns {object[]}
 */
export const addColumn = (columns, field, configured) => {
	if (!field) return columns
	if (!configured) return [{ field, name: field }]
	if (columns.some(column => column.field === field)) return columns
	return [...columns, { field, name: field }]
}

/**
 * Removes a column. An empty result is meaningful: the caller deletes the saved
 * layout and the table returns to its defaults.
 *
 * @param {object[]} columns
 * @param {string} field
 * @returns {object[]}
 */
export const removeColumn = (columns, field) =>
	columns.filter(column => column.field !== field)

/**
 * @param {object[]} columns
 * @param {number} from
 * @param {number} to
 * @returns {object[]}
 */
export const moveColumn = (columns, from, to) => {
	if (
		!Array.isArray(columns) ||
		from === to ||
		from < 0 ||
		to < 0 ||
		from >= columns.length ||
		to >= columns.length
	) {
		return columns
	}

	const moved = [...columns]
	const [column] = moved.splice(from, 1)
	moved.splice(to, 0, column)
	return moved
}

/**
 * @param {object[]} columns
 * @param {string} field
 * @param {string} name blank falls back to the field path
 * @returns {object[]}
 */
export const renameColumn = (columns, field, name) =>
	columns.map(column =>
		column.field === field
			? { ...column, name: String(name ?? '').trim() || field }
			: column
	)

/** @param {number} width */
export const clampColumnWidth = width =>
	Math.min(MAX_COLUMN_WIDTH, Math.max(MIN_COLUMN_WIDTH, Math.round(width)))

/**
 * @param {object[]} columns
 * @param {string} field
 * @param {number} width
 * @returns {object[]}
 */
export const setColumnWidth = (columns, field, width) =>
	columns.map(column =>
		column.field === field
			? { ...column, width: clampColumnWidth(width) }
			: column
	)

/**
 * Starting width for a column that has never been resized. Metadata columns
 * hold short values; `_source` holds a whole document.
 *
 * @param {string} field
 * @returns {number}
 */
export const defaultColumnWidth = field => {
	switch (field) {
		case '_score':
			return 90
		case '_index':
			return 180
		case '_id':
			return 240
		case '_source':
			return 720
		default:
			return 220
	}
}

/** @param {{ field: string, width?: number }} column */
export const columnWidth = column =>
	clampColumnWidth(column?.width ?? defaultColumnWidth(column?.field))

/**
 * Reads the value a column displays, resolving metadata fields off the hit
 * itself and everything else out of `_source`.
 *
 * @param {object} hit
 * @param {string} field
 * @returns {any}
 */
export const cellValue = (hit, field) => {
	switch (field) {
		case '_id':
			return hit?._id
		case '_index':
			return hit?._index
		case '_score':
			return hit?._score
		case '_source':
			return hit?._source
		default:
			return get(hit?._source, field)
	}
}

/**
 * Formats any value into a compact, truncated string representation.
 *
 * Truncation applies to primitives too: a single `text` field can hold a
 * megabyte-long log line, and that must not reach the DOM either.
 *
 * @param {any} value
 * @param {number} maxLen
 * @returns {string}
 */
export const formatCompactJSON = (value, maxLen = 60) => {
	if (value === null || value === undefined) return ''

	let str
	if (typeof value === 'object') {
		try {
			str = JSON.stringify(value) ?? String(value)
		} catch {
			str = String(value)
		}
	} else {
		str = String(value)
	}

	return str.length > maxLen ? str.substring(0, maxLen - 3) + '...' : str
}
