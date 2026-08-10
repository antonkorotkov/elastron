import { describe, it, expect } from 'vitest';
import {
	humanStoreSizeToPseudoBytes,
	isIndexNameValid,
	getVersionNumber,
	filterArrayBy,
	isThemeToggleChecked,
	getIndexListFromIndexData,
	randomId,
	getMessageFromError,
	indicesSortPredicate,
	shardsSortPredicate,
	allocationSortPredicate,
} from './helpers';

describe('humanStoreSizeToPseudoBytes', () => {
	it('converts byte strings correctly', () => {
		expect(humanStoreSizeToPseudoBytes('100b')).toBe(100);
		expect(humanStoreSizeToPseudoBytes('2.5kb')).toBe(2500);
		expect(humanStoreSizeToPseudoBytes('1mb')).toBe(1000000);
		expect(humanStoreSizeToPseudoBytes('1.5gb')).toBe(1500000000);
		expect(humanStoreSizeToPseudoBytes('1tb')).toBe(1000000000000);
	});

	it('returns the input for non-string values', () => {
		expect(humanStoreSizeToPseudoBytes(42)).toBe(42);
		expect(humanStoreSizeToPseudoBytes(null)).toBe(null);
	});

	it('returns undefined for unrecognized strings', () => {
		expect(humanStoreSizeToPseudoBytes('abc')).toBeUndefined();
	});
});

describe('isIndexNameValid', () => {
	it('allows lowercase alphanumeric, hyphens, and underscores', () => {
		expect(isIndexNameValid('my-index')).toBe(true);
		expect(isIndexNameValid('my_index_123')).toBe(true);
		expect(isIndexNameValid('a')).toBe(true);
	});

	it('rejects invalid index names', () => {
		expect(isIndexNameValid('MyIndex')).toBe(false);
		expect(isIndexNameValid('my index')).toBe(false);
		expect(isIndexNameValid('my.index')).toBe(false);
		expect(isIndexNameValid('')).toBe(false);
	});
});

describe('getVersionNumber', () => {
	it('returns a version number string as-is', () => {
		expect(getVersionNumber('8.12.0')).toBe('8.12.0');
	});

	it('unwraps the raw elasticsearch version object', () => {
		expect(getVersionNumber({ number: '9.0.1', build_flavor: 'default' })).toBe(
			'9.0.1'
		);
	});

	it('returns null when no version number is reported', () => {
		expect(getVersionNumber(undefined)).toBe(null);
		expect(getVersionNumber(null)).toBe(null);
		expect(getVersionNumber('')).toBe(null);
		expect(getVersionNumber({})).toBe(null);
		expect(getVersionNumber({ number: 9 })).toBe(null);
	});
});

describe('filterArrayBy', () => {
	const data = [
		['green', 'open', 'my-index'],
		['yellow', 'open', 'logs-2024'],
		['red', 'close', 'test-data'],
	];

	it('filters rows case-insensitively', () => {
		expect(filterArrayBy(data, 'my-index')).toHaveLength(1);
		expect(filterArrayBy(data, 'MY-INDEX')).toHaveLength(1);
	});

	it('matches across any column', () => {
		expect(filterArrayBy(data, 'green')).toHaveLength(1);
		expect(filterArrayBy(data, 'open')).toHaveLength(2);
	});

	it('returns empty for no match', () => {
		expect(filterArrayBy(data, 'nonexistent')).toHaveLength(0);
	});
});

describe('isThemeToggleChecked', () => {
	it('returns true for dark theme', () => {
		expect(isThemeToggleChecked('dark')).toBe(true);
	});

	it('returns false for light theme', () => {
		expect(isThemeToggleChecked('light')).toBe(false);
	});

	it('returns false for any other value', () => {
		expect(isThemeToggleChecked('other')).toBe(false);
	});
});

describe('getIndexListFromIndexData', () => {
	it('extracts index names from index data', () => {
		const indexData = {
			columns: ['health', 'status', 'index', 'uuid'],
			data: [
				['green', 'open', 'my-index', 'abc123'],
				['yellow', 'open', 'logs', 'def456'],
			],
		};
		expect(getIndexListFromIndexData(indexData)).toEqual([
			'my-index',
			'logs',
		]);
	});
});

describe('randomId', () => {
	it('returns a string', () => {
		expect(typeof randomId()).toBe('string');
	});

	it('returns different values on each call', () => {
		const ids = new Set(Array.from({ length: 10 }, randomId));
		expect(ids.size).toBeGreaterThan(1);
	});
});

describe('getMessageFromError', () => {
	it('extracts simple error messages', () => {
		expect(getMessageFromError(new Error('something broke'))).toBe(
			'something broke'
		);
	});

	it('extracts nested root_cause reason', () => {
		const err = {
			message: 'fallback',
			response: {
				data: {
					error: {
						root_cause: [{ reason: 'index_not_found' }],
					},
				},
			},
		};
		expect(getMessageFromError(err)).toBe('index_not_found');
	});

	it('extracts nested error.reason when no root_cause', () => {
		const err = {
			message: 'fallback',
			response: {
				data: {
					error: {
						reason: 'mapping parse error',
					},
				},
			},
		};
		expect(getMessageFromError(err)).toBe('mapping parse error');
	});

	it('strips IPC prefix from messages', () => {
		const err = new Error(
			"Error invoking remote method 'elastic-request': actual error"
		);
		expect(getMessageFromError(err)).toBe('actual error');
	});
});

describe('indicesSortPredicate', () => {
	it('returns numeric value for docs.count column', () => {
		const fn = indicesSortPredicate('docs.count', 2);
		expect(fn(['a', 'b', '42'])).toBe(42);
	});

	it('returns byte value for store.size column', () => {
		const fn = indicesSortPredicate('store.size', 0);
		expect(fn(['2kb'])).toBe(2000);
	});

	it('returns string value for other columns', () => {
		const fn = indicesSortPredicate('health', 0);
		expect(fn(['green'])).toBe('green');
	});
});

describe('shardsSortPredicate', () => {
	it('returns numeric value for shard column', () => {
		const fn = shardsSortPredicate('shard', 0);
		expect(fn(['3'])).toBe(3);
	});

	it('returns byte value for store column', () => {
		const fn = shardsSortPredicate('store', 0);
		expect(fn(['1mb'])).toBe(1000000);
	});
});

describe('allocationSortPredicate', () => {
	it('returns numeric for shards column', () => {
		const fn = allocationSortPredicate('shards', 0);
		expect(fn(['5'])).toBe(5);
	});

	it('returns byte value for disk.used', () => {
		const fn = allocationSortPredicate('disk.used', 0);
		expect(fn(['10gb'])).toBe(10000000000);
	});
});
