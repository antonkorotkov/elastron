import { describe, it, expect } from 'vitest';
import { buildRoleQuery, roleMatchesSearch, searchAndSortRoles } from './roleSearch';

const roles = [
	{ name: 'team_0001_reader', description: 'Reads logs for Squad 3' },
	{ name: 'Team_0000_reader', description: 'Reads logs for Squad 1' },
	{ name: 'ops_admin', description: 'Operations' },
];

describe('buildRoleQuery', () => {
	it('sends no query for an empty search', () => {
		expect(buildRoleQuery('  ')).toBeUndefined();
	});

	it('matches a name substring case-insensitively, or every word of the description', () => {
		expect(buildRoleQuery('Squad 3')).toEqual({
			bool: {
				should: [
					{ wildcard: { name: { value: '*Squad 3*', case_insensitive: true } } },
					{ match: { description: { query: 'Squad 3', operator: 'and' } } },
				],
				minimum_should_match: 1,
			},
		});
	});

	it('escapes wildcard characters the user typed', () => {
		expect(buildRoleQuery('a*b?').bool.should[0].wildcard.name.value).toBe('*a\\*b\\?*');
	});

	it('leaves the description out when the search has no words to match', () => {
		expect(buildRoleQuery('_*').bool.should).toHaveLength(1);
	});
});

describe('the fallback path searches the same way', () => {
	it.each([
		['TEAM_000', ['Team_0000_reader', 'team_0001_reader']],
		['squad 3', ['team_0001_reader']],
		['3 squad', ['team_0001_reader']],
		['squ', []],
		['ops', ['ops_admin']],
	])('%s', (search, expected) => {
		expect(roles.filter(r => roleMatchesSearch(r, search)).map(r => r.name).sort()).toEqual(
			[...expected].sort()
		);
	});

	it('orders names the way the cluster does, capitals first', () => {
		expect(searchAndSortRoles(roles, '').map(r => r.name)).toEqual([
			'Team_0000_reader',
			'ops_admin',
			'team_0001_reader',
		]);
		expect(searchAndSortRoles(roles, '', 'desc').map(r => r.name)[0]).toBe('team_0001_reader');
	});
});
