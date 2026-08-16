import { describe, it, expect } from 'vitest'
import {
	MAX_TABLE_CONFIGS,
	addColumn,
	buildBodySort,
	buildFieldIndex,
	buildUriSort,
	cellValue,
	clampColumnWidth,
	columnWidth,
	columnsOf,
	currentSortState,
	defaultColumnWidth,
	defaultColumns,
	flattenObject,
	flattenProperties,
	formatCompactJSON,
	getAvailableFields,
	isConfigured,
	isSortable,
	moveColumn,
	parseBodySort,
	parseUriSort,
	pruneTableConfigs,
	removeColumn,
	renameColumn,
	resolveSortTarget,
	sanitizeColumns,
	sanitizeTableConfigs,
	setColumnWidth,
} from './tableHelpers'

describe('flattenProperties', () => {
	it('flattens simple mapping properties', () => {
		const properties = {
			title: { type: 'text' },
			views: { type: 'integer' },
		}
		expect(flattenProperties(properties)).toEqual(['title', 'views'])
	})

	it('flattens nested object properties', () => {
		const properties = {
			user: {
				properties: {
					name: { type: 'keyword' },
					address: {
						properties: {
							city: { type: 'text' },
						},
					},
				},
			},
			timestamp: { type: 'date' },
		}
		expect(flattenProperties(properties)).toEqual([
			'user',
			'user.name',
			'user.address',
			'user.address.city',
			'timestamp',
		])
	})

	it('handles empty properties gracefully', () => {
		expect(flattenProperties(null)).toEqual([])
		expect(flattenProperties(undefined)).toEqual([])
		expect(flattenProperties({})).toEqual([])
	})

	it('omits multi-fields, which render identically to their parent', () => {
		const properties = {
			title: { type: 'text', fields: { keyword: { type: 'keyword' } } },
		}
		expect(flattenProperties(properties)).toEqual(['title'])
	})
})

describe('flattenObject', () => {
	it('flattens flat objects', () => {
		const obj = { name: 'Alice', age: 30 }
		expect(flattenObject(obj)).toEqual(['name', 'age'])
	})

	it('flattens nested objects', () => {
		const obj = {
			user: {
				name: 'Bob',
				details: {
					city: 'Paris',
				},
			},
			tags: ['es', 'svelte'],
		}
		// tags is an array, so it shouldn't be recursed into
		expect(flattenObject(obj)).toEqual([
			'user',
			'user.name',
			'user.details',
			'user.details.city',
			'tags',
		])
	})

	it('handles empty values gracefully', () => {
		expect(flattenObject(null)).toEqual([])
		expect(flattenObject(undefined)).toEqual([])
		expect(flattenObject({})).toEqual([])
	})
})

describe('getAvailableFields', () => {
	it('combines index mapping properties and search hits source fields', () => {
		const indexInfo = {
			'my-index-1': {
				mappings: {
					properties: {
						title: { type: 'text' },
						author: { type: 'keyword' },
					},
				},
			},
		}
		const hits = [
			{
				_source: {
					author: 'John',
					views: 120,
					metadata: {
						tags: ['a', 'b'],
					},
				},
			},
		]
		const fields = getAvailableFields(indexInfo, hits)
		expect(fields).toEqual([
			'author',
			'metadata',
			'metadata.tags',
			'title',
			'views',
		])
	})

	it('handles missing input data cleanly', () => {
		expect(getAvailableFields(null, null)).toEqual([])
	})

	it('merges every index a pattern resolved to', () => {
		const indexInfo = {
			'logs-2024': { mappings: { properties: { a: { type: 'keyword' } } } },
			'logs-2025': { mappings: { properties: { b: { type: 'keyword' } } } },
		}
		expect(getAvailableFields(indexInfo, [])).toEqual(['a', 'b'])
	})
})

describe('buildFieldIndex', () => {
	const indexInfo = {
		'my-index': {
			mappings: {
				properties: {
					title: { type: 'text', fields: { keyword: { type: 'keyword' } } },
					body: { type: 'text' },
					views: { type: 'integer' },
					user: { properties: { name: { type: 'keyword' } } },
				},
			},
		},
	}

	it('records types including multi-fields', () => {
		const { types } = buildFieldIndex(indexInfo)
		expect(types.title).toBe('text')
		expect(types['title.keyword']).toBe('keyword')
		expect(types.views).toBe('integer')
		expect(types.user).toBe('object')
		expect(types['user.name']).toBe('keyword')
	})

	it('sorts a sortable type on itself', () => {
		const { sortTargets } = buildFieldIndex(indexInfo)
		expect(sortTargets.views).toBe('views')
		expect(sortTargets['user.name']).toBe('user.name')
	})

	it('redirects a text field to its keyword multi-field', () => {
		const { sortTargets } = buildFieldIndex(indexInfo)
		expect(sortTargets.title).toBe('title.keyword')
	})

	it('marks a text field with no sortable multi-field unsortable', () => {
		const { sortTargets } = buildFieldIndex(indexInfo)
		expect(sortTargets.body).toBeNull()
		expect(sortTargets.user).toBeNull()
	})

	it('returns null when there is no usable mapping', () => {
		expect(buildFieldIndex(null)).toBeNull()
		expect(buildFieldIndex({})).toBeNull()
		expect(buildFieldIndex({ idx: { mappings: {} } })).toBeNull()
	})

	it('reads legacy `_doc` mappings', () => {
		const legacy = {
			idx: { mappings: { _doc: { properties: { at: { type: 'date' } } } } },
		}
		expect(buildFieldIndex(legacy).sortTargets.at).toBe('at')
	})
})

describe('resolveSortTarget', () => {
	const fieldIndex = buildFieldIndex({
		idx: {
			mappings: {
				properties: {
					title: { type: 'text', fields: { keyword: { type: 'keyword' } } },
					body: { type: 'text' },
					views: { type: 'long' },
				},
			},
		},
	})

	it('refuses metadata fields the cluster cannot sort on', () => {
		expect(resolveSortTarget('_id', fieldIndex)).toBeNull()
		expect(resolveSortTarget('_source', fieldIndex)).toBeNull()
	})

	it('allows sortable metadata fields', () => {
		expect(resolveSortTarget('_index', fieldIndex)).toBe('_index')
		expect(resolveSortTarget('_score', fieldIndex)).toBe('_score')
	})

	it('prefers a keyword multi-field over an unsortable parent', () => {
		expect(resolveSortTarget('title', fieldIndex)).toBe('title.keyword')
	})

	it('refuses a mapped field with no sortable representation', () => {
		expect(resolveSortTarget('body', fieldIndex)).toBeNull()
		expect(isSortable('body', fieldIndex)).toBe(false)
	})

	it('attempts fields the mapping does not describe', () => {
		// The mapping may be unavailable (_all) or the field dynamic — letting
		// the cluster decide beats refusing a sort that would have worked.
		expect(resolveSortTarget('unknown', fieldIndex)).toBe('unknown')
		expect(resolveSortTarget('anything', null)).toBe('anything')
	})
})

describe('sort parsing', () => {
	it('parses the first entry of a URI sort', () => {
		expect(parseUriSort('views:desc')).toEqual({
			field: 'views',
			direction: 'desc',
		})
		expect(parseUriSort('views:desc,title:asc')).toEqual({
			field: 'views',
			direction: 'desc',
		})
	})

	it('defaults a bare URI sort field to ascending', () => {
		expect(parseUriSort('views')).toEqual({ field: 'views', direction: 'asc' })
	})

	it('returns null for an absent URI sort', () => {
		expect(parseUriSort('')).toBeNull()
		expect(parseUriSort(undefined)).toBeNull()
	})

	it('parses every request body sort shape', () => {
		expect(parseBodySort('views')).toEqual({
			field: 'views',
			direction: 'asc',
		})
		expect(parseBodySort({ views: 'desc' })).toEqual({
			field: 'views',
			direction: 'desc',
		})
		expect(parseBodySort([{ views: { order: 'desc' } }])).toEqual({
			field: 'views',
			direction: 'desc',
		})
		expect(parseBodySort([{ a: 'asc' }, { b: 'desc' }])).toEqual({
			field: 'a',
			direction: 'asc',
		})
	})

	it('returns null for an absent body sort', () => {
		expect(parseBodySort(undefined)).toBeNull()
		expect(parseBodySort([])).toBeNull()
	})

	it('builds sorts in the shape each search type expects', () => {
		expect(buildUriSort('views', 'desc')).toBe('views:desc')
		expect(buildBodySort('views', 'desc')).toEqual([
			{ views: { order: 'desc' } },
		])
	})

	it('reads the active sort from the matching half of search state', () => {
		expect(currentSortState({ type: 'uri', sort: 'a:desc' })).toEqual({
			field: 'a',
			direction: 'desc',
		})
		expect(
			currentSortState({ type: 'body', requestBody: { sort: { b: 'asc' } } })
		).toEqual({ field: 'b', direction: 'asc' })
		expect(currentSortState(null)).toBeNull()
	})

	it('ignores the sort belonging to the other search type', () => {
		const search = { type: 'uri', sort: '', requestBody: { sort: { b: 'asc' } } }
		expect(currentSortState(search)).toBeNull()
	})
})

describe('column configuration', () => {
	it('falls back to defaults when nothing is saved', () => {
		expect(columnsOf(null)).toEqual(defaultColumns())
		expect(columnsOf({ columns: [] })).toEqual(defaultColumns())
		expect(isConfigured(null)).toBe(false)
		expect(isConfigured({ columns: [] })).toBe(false)
		expect(isConfigured({ columns: [{ field: 'a' }] })).toBe(true)
	})

	it('replaces the defaults with the first field added', () => {
		const columns = addColumn(defaultColumns(), 'title', false)
		expect(columns).toEqual([{ field: 'title', name: 'title' }])
	})

	it('appends to an already-configured layout', () => {
		const configured = [{ field: 'title', name: 'title' }]
		expect(addColumn(configured, 'views', true)).toEqual([
			{ field: 'title', name: 'title' },
			{ field: 'views', name: 'views' },
		])
	})

	it('never drops a column the user explicitly configured', () => {
		// The pattern-matching this replaced silently removed `_source` here.
		const explicit = [
			{ field: '_id', name: '_id' },
			{ field: '_source', name: '_source' },
		]
		expect(addColumn(explicit, 'title', true).map(c => c.field)).toEqual([
			'_id',
			'_source',
			'title',
		])
	})

	it('ignores an add for a field already present', () => {
		const columns = [{ field: 'title', name: 'title' }]
		expect(addColumn(columns, 'title', true)).toBe(columns)
	})

	it('returns an empty list when the last column is removed', () => {
		expect(removeColumn([{ field: 'title', name: 'title' }], 'title')).toEqual(
			[]
		)
	})

	it('moves columns and clamps out-of-range moves', () => {
		const columns = [{ field: 'a' }, { field: 'b' }, { field: 'c' }]
		expect(moveColumn(columns, 2, 0).map(c => c.field)).toEqual(['c', 'a', 'b'])
		expect(moveColumn(columns, 0, -1)).toBe(columns)
		expect(moveColumn(columns, 0, 3)).toBe(columns)
		expect(moveColumn(columns, 1, 1)).toBe(columns)
	})

	it('renames a column and falls back to the field path when blank', () => {
		const columns = [{ field: 'user.name', name: 'user.name' }]
		expect(renameColumn(columns, 'user.name', ' Name ')[0].name).toBe('Name')
		expect(renameColumn(columns, 'user.name', '   ')[0].name).toBe('user.name')
	})
})

describe('column widths', () => {
	it('gives metadata and document columns different starting widths', () => {
		expect(defaultColumnWidth('_score')).toBeLessThan(defaultColumnWidth('_id'))
		expect(defaultColumnWidth('_source')).toBeGreaterThan(
			defaultColumnWidth('title')
		)
	})

	it('clamps widths into a usable range', () => {
		expect(clampColumnWidth(5)).toBe(60)
		expect(clampColumnWidth(99999)).toBe(1600)
		expect(clampColumnWidth(240.4)).toBe(240)
	})

	it('prefers a saved width over the default', () => {
		expect(columnWidth({ field: '_id' })).toBe(defaultColumnWidth('_id'))
		expect(columnWidth({ field: '_id', width: 300 })).toBe(300)
	})

	it('stores a clamped width on the targeted column only', () => {
		const columns = [{ field: 'a' }, { field: 'b' }]
		const next = setColumnWidth(columns, 'a', 10)
		expect(next[0].width).toBe(60)
		expect(next[1].width).toBeUndefined()
	})
})

describe('sanitizing persisted configuration', () => {
	it('drops entries that are not usable columns', () => {
		const columns = sanitizeColumns([
			{ field: 'title', name: 'Title' },
			{ field: '  ' },
			{ name: 'no field' },
			null,
			'nope',
			{ field: 'title', name: 'duplicate' },
		])
		expect(columns).toEqual([{ field: 'title', name: 'Title' }])
	})

	it('defaults a missing name to the field path and clamps widths', () => {
		expect(sanitizeColumns([{ field: 'a', width: 5 }])).toEqual([
			{ field: 'a', name: 'a', width: 60 },
		])
		expect(sanitizeColumns([{ field: 'a', width: 'wide' }])).toEqual([
			{ field: 'a', name: 'a' },
		])
	})

	it('drops layouts with no usable columns', () => {
		expect(
			sanitizeTableConfigs({
				good: { columns: [{ field: 'a' }] },
				empty: { columns: [] },
				broken: 'nope',
			})
		).toEqual({ good: { columns: [{ field: 'a', name: 'a' }] } })
	})

	it('tolerates a hand-edited storage value of the wrong type', () => {
		expect(sanitizeTableConfigs(null)).toEqual({})
		expect(sanitizeTableConfigs([1, 2])).toEqual({})
		expect(sanitizeTableConfigs('nope')).toEqual({})
	})

	it('keeps layouts under the cap, never dropping the one just written', () => {
		const configs = {}
		for (let i = 0; i < MAX_TABLE_CONFIGS + 5; i++) {
			configs[`index-${i}`] = { columns: [{ field: 'a', name: 'a' }] }
		}

		const pruned = pruneTableConfigs(configs, 'index-0')
		expect(Object.keys(pruned)).toHaveLength(MAX_TABLE_CONFIGS)
		expect(pruned['index-0']).toBeDefined()
		// Oldest entries go first.
		expect(pruned['index-1']).toBeUndefined()
		expect(pruned[`index-${MAX_TABLE_CONFIGS + 4}`]).toBeDefined()
	})

	it('leaves a map under the cap untouched', () => {
		const configs = { a: { columns: [] } }
		expect(pruneTableConfigs(configs, 'a')).toBe(configs)
	})
})

describe('cellValue', () => {
	const hit = {
		_id: 'abc',
		_index: 'logs',
		_score: 1.5,
		_source: { user: { name: 'Ada' }, tags: ['a'] },
	}

	it('reads metadata off the hit and everything else out of _source', () => {
		expect(cellValue(hit, '_id')).toBe('abc')
		expect(cellValue(hit, '_index')).toBe('logs')
		expect(cellValue(hit, '_score')).toBe(1.5)
		expect(cellValue(hit, '_source')).toEqual(hit._source)
		expect(cellValue(hit, 'user.name')).toBe('Ada')
		expect(cellValue(hit, 'missing')).toBeUndefined()
	})

	it('survives a hit with no _source', () => {
		expect(cellValue({ _id: 'a' }, 'user.name')).toBeUndefined()
		expect(cellValue(undefined, '_id')).toBeUndefined()
	})
})

describe('formatCompactJSON', () => {
	it('renders flat types as strings', () => {
		expect(formatCompactJSON('hello')).toBe('hello')
		expect(formatCompactJSON(123)).toBe('123')
		expect(formatCompactJSON(null)).toBe('')
	})

	it('renders arrays/objects as compact strings, truncating if over max length', () => {
		const arr = [1, 2, 3]
		expect(formatCompactJSON(arr)).toBe('[1,2,3]')

		const obj = { a: 1, b: 2 }
		expect(formatCompactJSON(obj)).toBe('{"a":1,"b":2}')

		const longObj = { nested: { a: 'very long string to trigger truncation threshold' } }
		expect(formatCompactJSON(longObj, 25)).toBe('{"nested":{"a":"very l...')
	})

	it('falls back to String() on a value JSON cannot represent', () => {
		const circular = {}
		circular.self = circular
		expect(formatCompactJSON(circular)).toBe('[object Object]')
	})
})
