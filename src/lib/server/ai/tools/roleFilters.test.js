import { describe, it, expect } from 'vitest';
import { patternCovers, roleGrants } from './roleFilters.js';

describe('patternCovers', () => {
	it.each([
		['logs-*', 'logs-2026.09', true],
		['logs-*', 'metrics-2026.09', false],
		['logs-2026.0?', 'logs-2026.09', true],
		['logs-2026.09', 'logs-2026.09', true],
		['logs.2026', 'logsX2026', false],
		['/logs-[0-9]{4}\\.[0-9]{2}/', 'logs-2026.09', true],
		['/logs-[0-9]{4}\\.[0-9]{2}/', 'logs-2026.09-x', false],
	])('%s covers %s: %s', (pattern, index, expected) => {
		expect(patternCovers(pattern, index)).toBe(expected);
	});

	it('reads the complement the builtin viewer role uses', () => {
		const everythingButHidden = '/~(([.]|ilm-history-).*)/';
		expect(patternCovers(everythingButHidden, 'logs-2026.09')).toBe(true);
		expect(patternCovers(everythingButHidden, '.security-7')).toBe(false);
		expect(patternCovers(everythingButHidden, 'ilm-history-7')).toBe(false);
	});

	it('reads a Lucene escape as the literal character, not a JavaScript class', () => {
		expect(patternCovers('/logs-\\d+/', 'logs-1')).toBe(false);
		expect(patternCovers('/logs-\\d+/', 'logs-ddd')).toBe(true);
		expect(patternCovers('/logs\\.x/', 'logs.x')).toBe(true);
		expect(patternCovers('/logs\\.x/', 'logsYx')).toBe(false);
		expect(patternCovers('/[\\d]x/', 'dx')).toBe(true);
		expect(patternCovers('/[\\d]x/', '1x')).toBe(false);
	});

	it('treats ^ and $ as literal characters and quoted text as a literal string', () => {
		expect(patternCovers('/^logs/', 'logs')).toBe(false);
		expect(patternCovers('/^logs/', '^logs')).toBe(true);
		expect(patternCovers('/"a.b"c/', 'a.bc')).toBe(true);
		expect(patternCovers('/"a.b"c/', 'aXbc')).toBe(false);
	});

	it('applies a complement to its own branch only', () => {
		expect(patternCovers('/~(a)|(b)/', 'b')).toBe(true);
		expect(patternCovers('/~(a)|(b)/', 'c')).toBe(true);
		expect(patternCovers('/~(a)|(b)/', 'a')).toBe(false);
		expect(patternCovers('/(x|~(y))/', 'x')).toBe(true);
	});

	it('still matches a readable branch when another branch cannot be read', () => {
		expect(patternCovers('/logs-.*|a&b/', 'logs-1')).toBe(true);
		expect(patternCovers('/logs-.*|a&b/', 'other')).toBe(false);
	});

	it('skips a pattern it cannot read rather than guessing', () => {
		expect(patternCovers('/logs-(unclosed/', 'logs-(unclosed')).toBe(false);
		expect(patternCovers('/logs-<1-9>/', 'logs-5')).toBe(false);
		expect(patternCovers('/a&b/', 'a&b')).toBe(false);
	});
});

describe('roleGrants', () => {
	const role = indices => ({ cluster: ['monitor'], indices });
	const kinds = {
		cluster: new Set(['all', 'monitor', 'manage', 'manage_security']),
		index: new Set(['all', 'read', 'write', 'index', 'manage', 'monitor']),
	};

	it('needs the privilege on the same entry that covers the index', () => {
		const readsLogsWritesElsewhere = role([
			{ names: ['logs-*'], privileges: ['read'] },
			{ names: ['metrics-*'], privileges: ['write'] },
		]);
		expect(roleGrants(readsLogsWritesElsewhere, { index: 'logs-2026.09', privilege: 'write' })).toBe(false);
		expect(roleGrants(readsLogsWritesElsewhere, { index: 'logs-2026.09', privilege: 'read' })).toBe(true);
	});

	it('counts all as every privilege of its own kind', () => {
		expect(roleGrants(role([{ names: ['*'], privileges: ['all'] }]), { index: 'logs-1', privilege: 'write' }, kinds)).toBe(true);
		expect(roleGrants({ cluster: ['all'], indices: [] }, { privilege: 'manage_security' }, kinds)).toBe(true);
	});

	it('does not let an index all stand for a cluster privilege, or the reverse', () => {
		const sandboxOwner = { cluster: [], indices: [{ names: ['sandbox'], privileges: ['all'] }] };
		expect(roleGrants(sandboxOwner, { privilege: 'manage_security' }, kinds)).toBe(false);
		expect(roleGrants({ cluster: ['all'], indices: [] }, { privilege: 'write' }, kinds)).toBe(false);
		expect(roleGrants(sandboxOwner, { index: 'sandbox', privilege: 'manage_security' }, kinds)).toBe(false);
	});

	it('counts all only for itself when the privilege names are unknown', () => {
		expect(roleGrants({ cluster: ['all'], indices: [] }, { privilege: 'manage_security' })).toBe(false);
		expect(roleGrants({ cluster: ['all'], indices: [] }, { privilege: 'all' })).toBe(true);
	});

	it('matches a cluster privilege without an index', () => {
		expect(roleGrants({ cluster: ['manage_security'], indices: [] }, { privilege: 'manage_security' })).toBe(true);
		expect(roleGrants({ cluster: ['monitor'], indices: [] }, { privilege: 'manage_security' })).toBe(false);
	});

	it('does not apply implications Elasticsearch does not publish', () => {
		expect(roleGrants(role([{ names: ['logs-*'], privileges: ['write'] }]), { index: 'logs-1', privilege: 'index' })).toBe(false);
	});

	it('matches any access to an index when no privilege is given', () => {
		expect(roleGrants(role([{ names: ['logs-*'], privileges: ['read'] }]), { index: 'logs-1' })).toBe(true);
		expect(roleGrants(role([{ names: ['logs-*'], privileges: ['read'] }]), { index: 'audit' })).toBe(false);
	});
});
