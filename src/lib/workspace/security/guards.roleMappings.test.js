import { describe, it, expect } from 'vitest'
import {
	evaluateRules,
	MAPPING_LOCKOUT_REFUSAL,
	MAPPING_LOCKOUT_WARNING,
	refuseMappingChange,
	UNKNOWN,
} from './guards.js'

// Shaped as _authenticate reports an LDAP account.
const ALICE = {
	username: 'alice',
	authenticationType: 'realm',
	realm: { name: 'ldap1', type: 'ldap' },
	metadata: {
		ldap_dn: 'cn=alice,ou=people,dc=example,dc=com',
		ldap_groups: ['cn=ops,ou=groups,dc=example,dc=com', 'cn=admins,ou=groups,dc=example,dc=com'],
		team: 'core',
		level: 5,
	},
}

const SAML_BOB = { username: 'bob', realm: { name: 'saml1', type: 'saml' }, metadata: {} }

const field = (name, value) => ({ field: { [name]: value } })
const T = field('username', 'alice')
const F = field('username', 'nobody')
const U = field('username', '/al.*/')

describe('evaluateRules combinators', () => {
	it.each([
		['all', [T, T], true],
		['all', [T, F], false],
		['all', [T, U], UNKNOWN],
		['all', [F, U], false],
		['all', [], true],
		['any', [F, T], true],
		['any', [F, F], false],
		['any', [F, U], UNKNOWN],
		['any', [T, U], true],
		['any', [], false],
	])('%s over %j', (kind, rules, expected) => {
		expect(evaluateRules({ [kind]: rules }, ALICE)).toBe(expected)
	})

	it.each([
		[T, false],
		[F, true],
		[U, UNKNOWN],
	])('except negates %j', (rule, expected) => {
		expect(evaluateRules({ all: [{ except: rule }] }, ALICE)).toBe(expected)
	})
})

describe('evaluateRules fields', () => {
	it('matches the realm and one of several groups', () => {
		const rules = {
			all: [
				field('realm.name', 'ldap1'),
				field('groups', ['cn=sre,ou=groups,dc=example,dc=com', 'cn=admins,ou=groups,dc=example,dc=com']),
			],
		}
		expect(evaluateRules(rules, ALICE)).toBe(true)
	})

	it('compares DNs regardless of case and spacing', () => {
		expect(evaluateRules(field('groups', 'CN=Admins, OU=Groups, DC=Example, DC=Com'), ALICE)).toBe(true)
		expect(evaluateRules(field('dn', 'cn=alice, ou=people,dc=example,dc=com'), ALICE)).toBe(true)
	})

	it('matches a wildcard group DN', () => {
		expect(evaluateRules(field('groups', '*,ou=groups,dc=example,dc=com'), ALICE)).toBe(true)
		expect(evaluateRules(field('groups', '*,ou=other,dc=example,dc=com'), ALICE)).toBe(false)
	})

	it('matches a wildcard DN pattern as written, as the cluster does', () => {
		expect(evaluateRules(field('groups', 'CN=*,OU=GROUPS,DC=EXAMPLE,DC=COM'), ALICE)).toBe(true)
		expect(evaluateRules(field('groups', 'cn=*,OU=Groups,dc=example,dc=com'), ALICE)).toBe(false)
		expect(evaluateRules(field('groups', 'cn=*, ou=groups, dc=example, dc=com'), ALICE)).toBe(false)
		expect(evaluateRules(field('groups', '*,OU=Groups,DC=Example,DC=Com'), ALICE)).toBe(true)
	})

	it('does not trust a miss on a DN it cannot normalise as the cluster does', () => {
		expect(evaluateRules(field('groups', 'cn=ops\\,east,ou=groups,dc=example,dc=com'), ALICE)).toBe(UNKNOWN)
	})

	it('cannot judge a regular expression it does not otherwise match', () => {
		expect(evaluateRules(field('username', '/al.*/'), ALICE)).toBe(UNKNOWN)
		expect(evaluateRules(field('username', ['/x.*/', 'alice']), ALICE)).toBe(true)
	})

	it('matches usernames and realms exactly, and wildcards on them', () => {
		expect(evaluateRules(field('username', 'Alice'), ALICE)).toBe(false)
		expect(evaluateRules(field('username', 'al*'), ALICE)).toBe(true)
		expect(evaluateRules(field('realm.name', 'ldap?'), ALICE)).toBe(true)
	})

	it('reads metadata keys, keeping their types', () => {
		expect(evaluateRules(field('metadata.team', 'core'), ALICE)).toBe(true)
		expect(evaluateRules(field('metadata.level', 5), ALICE)).toBe(true)
		expect(evaluateRules(field('metadata.level', '5'), ALICE)).toBe(false)
	})

	it('cannot judge a field the identity does not report', () => {
		expect(evaluateRules(field('groups', 'cn=admins,ou=groups,dc=example,dc=com'), SAML_BOB)).toBe(UNKNOWN)
		expect(evaluateRules(field('metadata.missing', 'x'), ALICE)).toBe(UNKNOWN)
		expect(evaluateRules(field('nosuch', 'x'), ALICE)).toBe(UNKNOWN)
	})

	it('cannot judge a shape it does not know', () => {
		expect(evaluateRules(undefined, ALICE)).toBe(UNKNOWN)
		expect(evaluateRules({ weird: [] }, ALICE)).toBe(UNKNOWN)
	})
})

describe('refuseMappingChange', () => {
	const ADMINS = 'cn=admins,ou=groups,dc=example,dc=com'
	const catalogue = {
		ops_admin: { cluster: ['manage_security'] },
		viewer: { cluster: ['monitor'] },
	}
	const mapping = (roles, rules = field('groups', ADMINS), extra = {}) => ({ enabled: true, roles, rules, ...extra })
	const ldapAdmins = mapping(['ops_admin'])

	const judge = (before, after, others = [], identity = ALICE) =>
		refuseMappingChange(before, after, others, identity, catalogue)

	it('refuses deleting the only mapping that makes you an administrator', () => {
		expect(judge(ldapAdmins, null)).toEqual({ level: 'refuse', message: MAPPING_LOCKOUT_REFUSAL })
	})

	it.each([
		['disabling it', { ...ldapAdmins, enabled: false }],
		['removing its managing role', { ...ldapAdmins, roles: ['viewer'] }],
		['narrowing its rules past you', { ...ldapAdmins, rules: field('groups', 'cn=sre,ou=groups,dc=example,dc=com') }],
	])('refuses %s', (_, after) => {
		expect(judge(ldapAdmins, after)?.level).toBe('refuse')
	})

	it('allows an edit that keeps it applying to you', () => {
		expect(judge(ldapAdmins, { ...ldapAdmins, roles: ['ops_admin', 'viewer'] })).toBeNull()
	})

	it('allows the change while another enabled mapping still grants management', () => {
		const backup = mapping(['superuser'], field('realm.name', 'ldap1'))
		expect(judge(ldapAdmins, null, [backup])).toBeNull()
		expect(judge(ldapAdmins, null, [{ ...backup, enabled: false }])?.level).toBe('refuse')
	})

	it('does not count another mapping it cannot judge as keeping your access', () => {
		const maybe = mapping(['superuser'], field('username', '/al.*/'))
		expect(judge(ldapAdmins, null, [maybe])?.level).toBe('refuse')
	})

	it('allows deleting a mapping that does not apply to you', () => {
		expect(judge(mapping(['ops_admin'], field('groups', 'cn=sre,ou=groups,dc=example,dc=com')), null)).toBeNull()
	})

	it('allows deleting a mapping that grants nothing managing', () => {
		expect(judge(mapping(['viewer']), null)).toBeNull()
	})

	it('allows changing a mapping that is already disabled', () => {
		expect(judge({ ...ldapAdmins, enabled: false }, null)).toBeNull()
	})

	it.each([
		['a native account', { ...ALICE, authenticationType: 'realm', realm: { name: 'native1', type: 'native' } }],
		['a file account', { ...ALICE, authenticationType: 'realm', realm: { name: 'file1', type: 'file' } }],
		['a reserved account', { ...ALICE, authenticationType: 'realm', realm: { name: 'reserved', type: 'reserved' } }],
		['an API key', { ...ALICE, authenticationType: 'api_key', realm: { name: '_es_api_key', type: '_es_api_key' } }],
		['an account the cluster would not describe', { username: null, roles: [], authenticationType: null, realm: null }],
	])('never stops %s', (_, identity) => {
		expect(judge(ldapAdmins, null, [], identity)).toBeNull()
	})

	it('guards a token issued to a mapped account', () => {
		expect(judge(ldapAdmins, null, [], { ...ALICE, authenticationType: 'token' })?.level).toBe('refuse')
	})

	it('allows the change when the account holds a managing role no visible mapping grants', () => {
		// That role comes from a role mapping file, which the API does not show.
		expect(judge(ldapAdmins, null, [], { ...ALICE, roles: ['ops_admin', 'superuser'] })).toBeNull()
		expect(judge(ldapAdmins, null, [], { ...ALICE, roles: ['ops_admin'] })?.level).toBe('refuse')
		expect(judge(ldapAdmins, null, [], { ...ALICE, roles: ['ops_admin', 'viewer'] })?.level).toBe('refuse')
	})

	it('does not credit a hidden source with a role a visible mapping may grant', () => {
		const maybe = mapping(['superuser'], field('username', '/al.*/'))
		expect(judge(ldapAdmins, null, [maybe], { ...ALICE, roles: ['ops_admin', 'superuser'] })?.level).toBe('refuse')
	})

	it('asks when the rules depend on something the identity does not show', () => {
		const bob = { ...SAML_BOB, authenticationType: 'realm' }
		expect(judge(ldapAdmins, null, [], bob)).toEqual({ level: 'confirm', message: MAPPING_LOCKOUT_WARNING })
	})

	it('asks for a mapping that grants through templates', () => {
		const templated = { enabled: true, role_templates: [{ template: '{"source":"{{groups}}"}' }], rules: field('groups', ADMINS) }
		expect(judge(templated, null)?.level).toBe('confirm')
	})

	it('asks for a role the cluster does not describe, rather than assuming it is harmless', () => {
		expect(judge(mapping(['mystery']), null)?.level).toBe('confirm')
	})

	it('refuses removing superuser even though its definition was not looked up', () => {
		expect(judge(mapping(['superuser']), null)?.level).toBe('refuse')
	})
})
