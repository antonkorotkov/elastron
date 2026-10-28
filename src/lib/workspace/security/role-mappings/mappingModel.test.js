import { describe, it, expect } from 'vitest'
import {
	applyRules,
	buildRules,
	emptyCondition,
	emptyRulesForm,
	parseRules,
	rulesProblem,
	toWritableMapping,
} from './mappingModel'

const BARE = { field: { groups: 'cn=admins,dc=example,dc=com' } }

const ALL_WITH_EXCEPTION = {
	all: [
		{ field: { 'realm.name': 'ldap1' } },
		{ field: { groups: ['cn=ops,ou=groups,dc=example,dc=com', 'cn=sre,ou=groups,dc=example,dc=com'] } },
		{ except: { field: { groups: 'cn=contractors,ou=groups,dc=example,dc=com' } } },
	],
}

const ANY = { any: [{ field: { username: '/adm-.*/' } }, { field: { 'metadata.level': 5 } }] }

describe('parseRules and buildRules', () => {
	it.each([
		['a bare condition', BARE],
		['an all group with an exception', ALL_WITH_EXCEPTION],
		['an any group', ANY],
	])('round-trips %s unchanged', (_, rules) => {
		expect(buildRules(parseRules(rules))).toEqual(rules)
	})

	it('reads metadata keys and keeps non-string values', () => {
		expect(parseRules(ANY).conditions[1]).toEqual({ field: 'metadata', key: 'level', values: [5] })
	})

	it.each([
		['a group inside a group', { any: [{ all: [BARE, BARE] }, BARE] }],
		['an exception holding a group', { all: [BARE, { except: { any: [BARE, BARE] } }] }],
		['two exceptions', { all: [BARE, { except: BARE }, { except: BARE }] }],
		['an exception under any', { any: [BARE, { except: BARE }] }],
		['a top-level exception', { except: BARE }],
		['an empty group', { all: [] }],
		['a group holding only an exception', { all: [{ except: BARE }] }],
		['a field the form does not know', { field: { nosuch: 'x' } }],
		['a field node with two keys', { field: { username: 'a', dn: 'b' } }],
		['no rules', undefined],
	])('cannot show %s', (_, rules) => {
		expect(parseRules(rules)).toBeNull()
	})

	it('saves a bare condition with a second condition added as an all group', () => {
		const form = parseRules(BARE)
		form.conditions.push({ field: 'realm.name', key: '', values: ['ldap1'] })
		expect(buildRules(form)).toEqual({ all: [BARE, { field: { 'realm.name': 'ldap1' } }] })
	})

	it('trims a metadata key', () => {
		const form = { kind: 'all', conditions: [{ field: 'metadata', key: ' team ', values: ['ops'] }], exception: null }
		expect(buildRules(form)).toEqual({ field: { 'metadata.team': 'ops' } })
	})
})

describe('applyRules', () => {
	it('replaces only the rules', () => {
		const mapping = { enabled: false, roles: ['viewer'], rules: BARE, metadata: { owner: 'ops' } }
		const form = parseRules(BARE)
		form.conditions[0].values = ['cn=other']
		expect(applyRules(mapping, form)).toEqual({ ...mapping, rules: { field: { groups: 'cn=other' } } })
	})
})

describe('rulesProblem', () => {
	it('needs a condition', () => {
		expect(rulesProblem({ kind: 'all', conditions: [], exception: null })).toMatch(/at least one condition/)
	})

	it('needs values and a metadata key', () => {
		expect(rulesProblem(emptyRulesForm())).toMatch(/at least one value/)
		expect(
			rulesProblem({ kind: 'all', conditions: [{ field: 'metadata', key: '', values: ['x'] }], exception: null })
		).toMatch(/key/)
	})

	it('refuses an exception unless all conditions must hold', () => {
		const exception = { ...emptyCondition(), values: ['cn=x'] }
		const conditions = [{ ...emptyCondition(), values: ['cn=y'] }]
		expect(rulesProblem({ kind: 'any', conditions, exception })).toMatch(/only accepts an exception/)
		expect(rulesProblem({ kind: 'all', conditions, exception })).toBeNull()
	})
})

describe('toWritableMapping', () => {
	it('strips what the list adds and underscore metadata keys', () => {
		const entry = {
			name: 'm',
			readOnly: false,
			usesTemplates: false,
			rulesText: 'x',
			enabled: true,
			roles: ['viewer'],
			rules: BARE,
			metadata: { _read_only: true, owner: 'ops' },
		}
		expect(toWritableMapping(entry)).toEqual({ enabled: true, roles: ['viewer'], rules: BARE, metadata: { owner: 'ops' } })
	})

	it('drops metadata left empty', () => {
		expect(toWritableMapping({ enabled: true, metadata: {} })).toEqual({ enabled: true })
	})
})
