import { describe, it, expect } from 'vitest'
import {
	flattenProperties,
	flattenObject,
	getAvailableFields,
	formatCompactJSON,
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
})
