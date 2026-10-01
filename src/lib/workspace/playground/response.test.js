import { describe, it, expect } from 'vitest'
import { NOT_JSON, pickResponseView, statusClass, toJsonValue, toRawText } from './response'

describe('pickResponseView', () => {
	it.each([
		['application/json', '{"a":1}'],
		['application/vnd.elasticsearch+json; compatible-with=8', '{}'],
	])('picks json for a %s response', (contentType, body) => {
		expect(pickResponseView({ body, contentType })).toBe('json')
	})

	it('picks json for an object body without a content type', () => {
		expect(pickResponseView({ body: { took: 1 } })).toBe('json')
	})

	it.each([
		['text/plain; charset=UTF-8', 'green open logs\n'],
		['application/yaml', 'cluster_name: x\n'],
		['text/plain', ''],
		['', true],
		['', false],
	])('picks raw for a %s response', (contentType, body) => {
		expect(pickResponseView({ body, contentType })).toBe('raw')
	})
})

describe('toRawText', () => {
	it('keeps text unchanged', () => {
		expect(toRawText('a  b\nc  d\n')).toBe('a  b\nc  d\n')
		expect(toRawText('')).toBe('')
	})

	it('pretty-prints objects', () => {
		expect(toRawText({ a: { b: 1 } })).toBe('{\n  "a": {\n    "b": 1\n  }\n}')
	})

	it('writes booleans as text', () => {
		expect(toRawText(true)).toBe('true')
		expect(toRawText(false)).toBe('false')
	})
})

describe('toJsonValue', () => {
	it('returns objects unchanged', () => {
		const body = { a: 1 }
		expect(toJsonValue(body)).toBe(body)
	})

	it('parses text that is JSON', () => {
		expect(toJsonValue('[{"index":"logs"}]')).toEqual([{ index: 'logs' }])
	})

	it.each([['green open logs\n'], [''], ['42'], [true], [false]])(
		'marks %j as not JSON',
		body => {
			expect(toJsonValue(body)).toBe(NOT_JSON)
		}
	)
})

describe('statusClass', () => {
	it.each([
		[200, 'success'],
		[201, 'success'],
		[400, 'client-error'],
		[404, 'client-error'],
		[500, 'server-error'],
		[503, 'server-error'],
	])('classifies %i as %s', (statusCode, expected) => {
		expect(statusClass(statusCode)).toBe(expected)
	})
})
