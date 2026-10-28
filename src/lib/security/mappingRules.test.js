import { describe, it, expect } from 'vitest';
import { describeRules, isReadOnlyMapping } from './mappingRules';
import { toRoleMappingEntries } from '../store/elasticsearch/securityList';

// Payloads as 8.19.9 and 9.3.4 returned them.
const LDAP_OPS = {
	enabled: true,
	roles: ['viewer'],
	rules: {
		all: [
			{ field: { 'realm.name': 'ldap1' } },
			{ field: { groups: ['cn=ops,ou=groups,dc=example,dc=com', 'cn=sre,ou=groups,dc=example,dc=com'] } },
			{ except: { field: { groups: 'cn=contractors,ou=groups,dc=example,dc=com' } } },
		],
	},
	metadata: {},
};

const TEMPLATED = {
	enabled: true,
	role_templates: [{ template: '{"source":"{{#tojson}}groups{{/tojson}}"}', format: 'json' }],
	rules: {
		any: [
			{ all: [{ field: { username: 'a' } }, { field: { 'metadata.level': 5 } }] },
			{ field: { dn: '/cn=adm.*/' } },
		],
	},
	metadata: {},
};

const OPERATOR = {
	enabled: true,
	roles: ['superuser'],
	rules: { field: { groups: 'cn=admins,dc=example,dc=com' } },
	metadata: { source: 'file', _read_only: true },
};

describe('describeRules', () => {
	it('reads a single condition', () => {
		expect(describeRules(OPERATOR.rules)).toBe('groups = cn=admins,dc=example,dc=com');
	});

	it('reads a group with alternatives and an exception', () => {
		expect(describeRules(LDAP_OPS.rules)).toBe(
			'realm.name = ldap1 AND groups in (cn=ops,ou=groups,dc=example,dc=com, cn=sre,ou=groups,dc=example,dc=com) AND NOT groups = cn=contractors,ou=groups,dc=example,dc=com'
		);
	});

	it('brackets a nested group and keeps non-string values recognisable', () => {
		expect(describeRules(TEMPLATED.rules)).toBe('(username = a AND metadata.level = 5) OR dn = /cn=adm.*/');
	});

	it('says what an empty group means', () => {
		expect(describeRules({ all: [] })).toBe('always');
		expect(describeRules({ any: [] })).toBe('never');
	});
});

describe('isReadOnlyMapping', () => {
	it('recognises either mark the cluster puts on an operator mapping', () => {
		expect(isReadOnlyMapping('x', { metadata: { _read_only: true } })).toBe(true);
		expect(isReadOnlyMapping('x-read-only-operator-mapping', { metadata: {} })).toBe(true);
		expect(isReadOnlyMapping('ldap-ops', LDAP_OPS)).toBe(false);
	});
});

describe('toRoleMappingEntries', () => {
	const entries = toRoleMappingEntries({
		'ldap-ops': LDAP_OPS,
		tpl: TEMPLATED,
		'operator-ldap-admins-read-only-operator-mapping': OPERATOR,
	});
	const byName = Object.fromEntries(entries.map(e => [e.name, e]));

	it('keeps the cluster definition alongside what the list adds', () => {
		expect(byName['ldap-ops']).toMatchObject({
			...LDAP_OPS,
			name: 'ldap-ops',
			readOnly: false,
			usesTemplates: false,
			rulesText: describeRules(LDAP_OPS.rules),
		});
	});

	it('marks a mapping that grants through templates', () => {
		expect(byName.tpl.usesTemplates).toBe(true);
		expect(byName.tpl.rulesText).toContain('OR');
	});

	it('marks an operator mapping read-only', () => {
		expect(byName['operator-ldap-admins-read-only-operator-mapping'].readOnly).toBe(true);
	});

	it('answers nothing for nothing', () => {
		expect(toRoleMappingEntries(undefined)).toEqual([]);
	});
});
