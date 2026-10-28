import { ROLE_PAGE_SIZE, searchAndSortRoles } from './roleSearch.js';
import { toRoleEntries } from '../store/elasticsearch/securityList.js';

// The cluster may hold thousands of roles, so a role picker asks it for the
// ones matching what was typed. A cluster that cannot page answers the first
// question with the whole list, which every later search waits on and filters
// here, rather than downloading it again while it is still arriving.
export const createRoleFinder = (ask, onError) => {
	let first = null;

	return async text => {
		try {
			first ??= { text, answer: ask(text) };
			const opening = await first.answer;
			const answer = opening?.mode === 'full' || first.text === text ? opening : await ask(text);

			const entries = toRoleEntries(answer?.roles);
			const found = answer?.mode === 'full' ? searchAndSortRoles(entries, text) : entries;
			onError('');
			return found.map(r => r.name).slice(0, ROLE_PAGE_SIZE);
		} catch (err) {
			first = null;
			onError(err?.message || 'Roles could not be read from this cluster.');
			return [];
		}
	};
};
