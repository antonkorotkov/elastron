import { describe, it, expect } from 'vitest';
import profiling, { isLegacyProfile, getTimeMillis } from './index';

describe('profiling helpers', () => {
	it('converts nanos to millis', () => {
		expect(getTimeMillis(2500000)).toBe(2.5);
	});

	it('detects pre-5.0 servers', () => {
		expect(isLegacyProfile('2.4.6')).toBe(true);
		expect(isLegacyProfile('8.12.0')).toBe(false);
	});

	it('treats an unknown version as modern instead of throwing', () => {
		expect(isLegacyProfile(null)).toBe(false);
		expect(isLegacyProfile(undefined)).toBe(false);
		expect(isLegacyProfile({ number: '8.12.0' })).toBe(false);
		expect(isLegacyProfile('not-a-version')).toBe(false);
	});

	it('reads modern query fields when the version is unknown', () => {
		const query = profiling.query({
			type: 'BooleanQuery',
			description: '+foo',
			time_in_nanos: 1000,
		});
		expect(query.getType(null)).toBe('BooleanQuery');
		expect(query.getDescription(null)).toBe('+foo');
		expect(query.getNanos(null)).toBe(1000);
	});

	it('reads legacy query fields on pre-5.0 servers', () => {
		const query = profiling.query({
			query_type: 'BooleanQuery',
			lucene: '+foo',
			time: '1.5ms',
		});
		expect(query.getType('2.4.6')).toBe('BooleanQuery');
		expect(query.getDescription('2.4.6')).toBe('+foo');
		expect(query.getNanos('2.4.6')).toBe(1500000);
	});
});
