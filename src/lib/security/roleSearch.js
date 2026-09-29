// How roles are searched and ordered. The route builds the cluster query from
// it and the renderer applies the same rules to a full list, so a search
// answers the same whichever path served it.

export const ROLE_PAGE_SIZE = 100;

const escapeWildcard = text => text.replace(/[\\*?]/g, match => `\\${match}`);

// The description is analysed text, so it matches whole words; the name is a
// keyword, so it matches any substring.
const wordsOf = text =>
	String(text || '')
		.toLowerCase()
		.split(/[^\p{L}\p{N}]+/u)
		.filter(Boolean);

export const buildRoleQuery = search => {
	const text = String(search || '').trim();
	if (!text) return undefined;

	const should = [
		{ wildcard: { name: { value: `*${escapeWildcard(text)}*`, case_insensitive: true } } },
	];
	if (wordsOf(text).length) {
		should.push({ match: { description: { query: text, operator: 'and' } } });
	}
	return { bool: { should, minimum_should_match: 1 } };
};

export const roleMatchesSearch = (role, search) => {
	const text = String(search || '').trim().toLowerCase();
	if (!text) return true;
	if (String(role?.name || '').toLowerCase().includes(text)) return true;

	const wanted = wordsOf(text);
	if (!wanted.length) return false;
	const present = new Set(wordsOf(role?.description));
	return wanted.every(word => present.has(word));
};

// The cluster sorts names as keywords, by code point, so `Team_1` comes before
// `team_0`. localeCompare would disagree with it.
export const compareRoleNames = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

export const searchAndSortRoles = (roles, search, direction = 'asc') => {
	const found = roles.filter(role => roleMatchesSearch(role, search));
	found.sort((a, b) => compareRoleNames(a.name, b.name));
	return direction === 'desc' ? found.reverse() : found;
};
