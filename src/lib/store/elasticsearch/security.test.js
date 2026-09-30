import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createStoreon } from 'storeon';

const whoAmI = vi.fn();
const getSecurityUsers = vi.fn();
// Most cases only care about the list, so they answer as a cluster without the
// role query endpoint would. The paging cases drive querySecurityRoles directly.
const getSecurityRoles = vi.fn();
const querySecurityRoles = vi.fn();
const getSecurityApiKeys = vi.fn();
const answerWholeList = async () => ({ mode: 'full', roles: await getSecurityRoles() });

vi.mock('../../api/elasticsearch', () => ({
	default: vi.fn(function () {
		return { whoAmI, getSecurityUsers, querySecurityRoles, getSecurityApiKeys };
	}),
}));

const { securityIdentity } = await import('./securityIdentity');
const { securityUsers } = await import('./securityUsers');
const { securityRoles } = await import('./securityRoles');
const { securityApiKeys } = await import('./securityApiKeys');
const { toRoleEntries, toUserEntries } = await import('./securityList');

const refused = (cause, message = 'refused') => Object.assign(new Error(message), { cause });

const flush = () => new Promise(r => setTimeout(r, 0));

let store;
beforeEach(() => {
	vi.clearAllMocks();
	querySecurityRoles.mockReset().mockImplementation(answerWholeList);
	store = createStoreon([securityIdentity, securityUsers, securityRoles, securityApiKeys]);
});

describe('securityIdentity', () => {
	it('records the connected account after connect and clears it on disconnect', async () => {
		whoAmI.mockResolvedValue({ username: 'elastic', roles: ['superuser'], metadata: { _reserved: true } });

		store.dispatch('connected');
		await flush();

		expect(store.get().securityIdentity).toMatchObject({
			username: 'elastic',
			roles: ['superuser'],
			reserved: true,
			loading: false,
		});

		store.dispatch('disconnected');
		expect(store.get().securityIdentity).toMatchObject({ username: null, roles: [] });
	});

	it('records a cause instead of an identity when the cluster will not say', async () => {
		whoAmI.mockRejectedValue(refused('security-disabled'));

		store.dispatch('connected');
		await flush();

		expect(store.get().securityIdentity).toMatchObject({ username: null, cause: 'security-disabled' });
	});
});

describe('security list stores', () => {
	it('loads users and roles independently', async () => {
		getSecurityUsers.mockResolvedValue({ alice: { roles: ['viewer'], enabled: true } });
		getSecurityRoles.mockResolvedValue({ r: { cluster: ['monitor'], indices: [] } });

		store.dispatch('security/users/fetch');
		store.dispatch('security/roles/fetch');
		await flush();

		expect(store.get().securityUsers.entries).toHaveLength(1);
		expect(store.get().securityRoles.entries).toHaveLength(1);
	});

	it('a failure on one surface leaves the others untouched', async () => {
		getSecurityUsers.mockRejectedValue(refused('privilege'));
		getSecurityRoles.mockResolvedValue({ r: { cluster: [], indices: [] } });

		store.dispatch('security/users/fetch');
		store.dispatch('security/roles/fetch');
		await flush();

		expect(store.get().securityUsers).toMatchObject({ cause: 'privilege', entries: [] });
		expect(store.get().securityRoles).toMatchObject({ cause: null });
		expect(store.get().securityRoles.entries).toHaveLength(1);
	});

	it('reports a failed refresh through the notification tray, not the table', async () => {
		const notes = [];
		const sink = s => s.on('notification/add', (_st, n) => notes.push(n));
		const withSink = createStoreon([sink, securityRoles]);

		getSecurityRoles.mockResolvedValueOnce({ r: { cluster: [], indices: [] } });
		withSink.dispatch('security/roles/fetch');
		await flush();

		getSecurityRoles.mockRejectedValueOnce(refused('privilege', 'refused'));
		withSink.dispatch('security/roles/fetch');
		await flush();

		expect(notes.at(-1)).toMatchObject({ type: 'error', message: 'refused' });
	});

	it('does not notify when the very first load fails, since the surface explains it', async () => {
		const notes = [];
		const sink = s => s.on('notification/add', (_st, n) => notes.push(n));
		const withSink = createStoreon([sink, securityRoles]);

		getSecurityRoles.mockRejectedValueOnce(refused('privilege'));
		withSink.dispatch('security/roles/fetch');
		await flush();

		expect(notes).toHaveLength(0);
		expect(withSink.get().securityRoles.cause).toBe('privilege');
	});

	it('keeps entries on screen when a refresh fails', async () => {
		getSecurityRoles.mockResolvedValueOnce({ r: { cluster: [], indices: [] } });
		store.dispatch('security/roles/fetch');
		await flush();
		expect(store.get().securityRoles.entries).toHaveLength(1);

		getSecurityRoles.mockRejectedValueOnce(refused('privilege'));
		store.dispatch('security/roles/fetch');
		await flush();

		expect(store.get().securityRoles.entries).toHaveLength(1);
		expect(store.get().securityRoles.cause).toBe('privilege');
	});

	it('does not report loaded before the first load resolves', () => {
		expect(store.get().securityRoles.loaded).toBe(false);
		store.dispatch('security/roles/fetch');
		expect(store.get().securityRoles).toMatchObject({ loading: true, loaded: false });
	});

	it('clears on disconnect', async () => {
		getSecurityRoles.mockResolvedValue({ r: { cluster: [], indices: [] } });
		store.dispatch('security/roles/fetch');
		await flush();

		store.dispatch('disconnected');
		expect(store.get().securityRoles).toMatchObject({ entries: [], loaded: false });
	});
});

describe('api key scope fallback', () => {
	it('retries with the own-keys scope when the unscoped listing is refused', async () => {
		getSecurityApiKeys.mockRejectedValueOnce(refused('privilege'));
		getSecurityApiKeys.mockResolvedValueOnce({ api_keys: [{ id: 'k1', name: 'mine' }] });

		store.dispatch('security/api-keys/fetch');
		await flush();

		expect(getSecurityApiKeys).toHaveBeenNthCalledWith(1, false);
		expect(getSecurityApiKeys).toHaveBeenNthCalledWith(2, true);
		expect(store.get().securityApiKeys).toMatchObject({ scope: 'own', cause: null });
	});

	it('does not retry when the refusal is not about privilege', async () => {
		getSecurityApiKeys.mockRejectedValue(refused('security-disabled'));

		store.dispatch('security/api-keys/fetch');
		await flush();

		expect(getSecurityApiKeys).toHaveBeenCalledTimes(1);
		expect(store.get().securityApiKeys.cause).toBe('security-disabled');
	});
});

describe('entry shaping', () => {
	it('marks reserved users', () => {
		expect(toUserEntries({ elastic: { metadata: { _reserved: true } } })[0]).toMatchObject({
			username: 'elastic',
			reserved: true,
		});
	});

	it('flags roles that restrict documents or fields', () => {
		const [role] = toRoleEntries({
			r: { indices: [{ names: ['a'], privileges: ['read'], query: '{"term":{}}' }] },
		});
		expect(role).toMatchObject({ name: 'r', hasDocumentQuery: true, hasFieldSecurity: false });
	});
});

describe('api key listing defaults', () => {
	it('starts with invalidated keys hidden, since nothing can remove them', () => {
		expect(store.get().securityApiKeys.showInvalidated).toBe(false);
	});

	it('remembers the choice to show them', () => {
		store.dispatch('security/api-keys/update', { showInvalidated: true });
		expect(store.get().securityApiKeys.showInvalidated).toBe(true);
	});

	it('resets the choice on disconnect, along with everything else', async () => {
		store.dispatch('security/api-keys/update', { showInvalidated: true });
		store.dispatch('disconnected');
		expect(store.get().securityApiKeys.showInvalidated).toBe(false);
	});

	it('leaves the other surfaces without the flag', () => {
		expect(store.get().securityRoles.showInvalidated).toBeUndefined();
		expect(store.get().securityUsers.showInvalidated).toBeUndefined();
	});
})

describe('the cluster own wording', () => {
	it('reaches the surface so it can be offered as supporting detail', async () => {
		const refusal = Object.assign(new Error('not available'), {
			cause: 'security-disabled',
			reason: 'Incorrect HTTP method for uri [/_security/role] and method [GET], allowed: [POST]',
		});
		getSecurityRoles.mockRejectedValueOnce(refusal);

		store.dispatch('security/roles/fetch');
		await flush();

		expect(store.get().securityRoles.reason).toBe(refusal.reason);
	});

	it('starts absent and is cleared by a load that succeeds', async () => {
		expect(store.get().securityRoles.reason).toBeNull();

		getSecurityRoles.mockRejectedValueOnce(Object.assign(new Error('x'), { cause: 'privilege', reason: 'why' }));
		store.dispatch('security/roles/fetch');
		await flush();
		expect(store.get().securityRoles.reason).toBe('why');

		getSecurityRoles.mockResolvedValueOnce({ r: { cluster: [], indices: [] } });
		store.dispatch('security/roles/fetch');
		await flush();
		expect(store.get().securityRoles.reason).toBeNull();
	});
});

describe('switching to another cluster', () => {
	it('clears the previous cluster\'s rows and reloads a list that was in use', async () => {
		whoAmI.mockResolvedValue({ username: 'elastic', roles: ['superuser'] });
		getSecurityUsers.mockResolvedValueOnce({ alice: { roles: [] } });
		store.dispatch('security/users/fetch');
		await flush();

		getSecurityUsers.mockResolvedValueOnce({ bob: { roles: [] } });
		store.dispatch('connected');
		expect(store.get().securityUsers.entries).toEqual([]);
		await flush();

		expect(store.get().securityUsers.entries.map(u => u.username)).toEqual(['bob']);
		expect(getSecurityRoles).not.toHaveBeenCalled();
	});

	it('drops a response from the previous cluster that lands after the switch', async () => {
		whoAmI.mockResolvedValue({ username: 'elastic', roles: [] });
		let resolveOld;
		getSecurityUsers.mockReturnValueOnce(new Promise(r => (resolveOld = r)));
		store.dispatch('security/users/fetch');

		getSecurityUsers.mockResolvedValueOnce({ bob: { roles: [] } });
		store.dispatch('connected');
		await flush();

		resolveOld({ alice: { roles: [] } });
		await flush();

		expect(store.get().securityUsers.entries.map(u => u.username)).toEqual(['bob']);
	});

	it('forgets the previous account before the new one is known', () => {
		store.dispatch('security/identity/update', { username: 'admin', roles: ['superuser'] });
		whoAmI.mockReturnValue(new Promise(() => {}));

		store.dispatch('connected');

		expect(store.get().securityIdentity).toMatchObject({ username: null, roles: [] });
	});
});

describe('paged roles', () => {
	const role = name => ({ name, cluster: [], indices: [] });
	const page = (names, { total = 250, cursor = [names.at(-1)] } = {}) => ({
		mode: 'paged',
		roles: names.map(role),
		total,
		cursor,
	});
	const names = () => store.get().securityRoles.entries.map(r => r.name);

	it('loads the first page, then appends the next one from the cursor', async () => {
		querySecurityRoles.mockResolvedValueOnce(page(['a', 'b'])).mockResolvedValueOnce(page(['c'], { cursor: null }));

		store.dispatch('security/roles/fetch');
		await flush();
		expect(store.get().securityRoles).toMatchObject({ mode: 'paged', total: 250, cursor: ['b'] });

		store.dispatch('security/roles/more');
		await flush();

		expect(querySecurityRoles).toHaveBeenLastCalledWith(expect.objectContaining({ after: ['b'] }));
		expect(names()).toEqual(['a', 'b', 'c']);
		expect(store.get().securityRoles.cursor).toBeNull();
	});

	it('asks for one next page at a time, and none once the list is complete', async () => {
		querySecurityRoles.mockResolvedValueOnce(page(['a']));
		store.dispatch('security/roles/fetch');
		await flush();

		querySecurityRoles.mockReturnValueOnce(new Promise(() => {}));
		store.dispatch('security/roles/more');
		store.dispatch('security/roles/more');
		expect(querySecurityRoles).toHaveBeenCalledTimes(2);

		const done = createStoreon([securityRoles]);
		querySecurityRoles.mockResolvedValueOnce(page(['a'], { cursor: null }));
		done.dispatch('security/roles/fetch');
		await flush();
		done.dispatch('security/roles/more');
		expect(querySecurityRoles).toHaveBeenCalledTimes(3);
	});

	it('reloads from the first page when the search or sort changes', async () => {
		querySecurityRoles.mockResolvedValue(page(['a']));
		store.dispatch('security/roles/fetch');
		await flush();

		store.dispatch('security/roles/search', 'ops');
		await flush();
		expect(querySecurityRoles).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'ops', after: null }));

		store.dispatch('security/roles/sort', 'desc');
		await flush();
		expect(querySecurityRoles).toHaveBeenLastCalledWith(
			expect.objectContaining({ search: 'ops', direction: 'desc', after: null })
		);
	});

	it('drops a page for a search that has since changed', async () => {
		let resolveOld;
		querySecurityRoles.mockReturnValueOnce(new Promise(r => (resolveOld = r)));
		store.dispatch('security/roles/search', 'old');

		querySecurityRoles.mockResolvedValueOnce(page(['new_match']));
		store.dispatch('security/roles/search', 'new');
		await flush();

		resolveOld(page(['old_match']));
		await flush();

		expect(names()).toEqual(['new_match']);
	});

	it('drops a next page that arrives after the search changed', async () => {
		querySecurityRoles.mockResolvedValueOnce(page(['a']));
		store.dispatch('security/roles/fetch');
		await flush();

		let resolveMore;
		querySecurityRoles.mockReturnValueOnce(new Promise(r => (resolveMore = r)));
		store.dispatch('security/roles/more');

		querySecurityRoles.mockResolvedValueOnce(page(['z']));
		store.dispatch('security/roles/search', 'z');
		await flush();

		resolveMore(page(['b']));
		await flush();

		expect(names()).toEqual(['z']);
	});

	it('remembers a fallback to the whole list and stops refetching for searches', async () => {
		getSecurityRoles.mockResolvedValue({ a: role('a'), b: role('b') });
		store.dispatch('security/roles/fetch');
		await flush();
		expect(store.get().securityRoles).toMatchObject({ mode: 'full', total: 2, cursor: null });

		store.dispatch('security/roles/search', 'a');
		store.dispatch('security/roles/sort', 'desc');
		await flush();
		expect(querySecurityRoles).toHaveBeenCalledTimes(1);

		store.dispatch('security/roles/fetch');
		await flush();
		expect(querySecurityRoles).toHaveBeenLastCalledWith(expect.objectContaining({ full: true }));
	});

	it('forgets the fallback on a connection switch, since the new cluster may page', async () => {
		getSecurityRoles.mockResolvedValue({ a: role('a') });
		store.dispatch('security/roles/fetch');
		await flush();

		whoAmI.mockResolvedValue({ username: 'elastic', roles: [] });
		querySecurityRoles.mockResolvedValue(page(['a']));
		store.dispatch('connected');
		await flush();

		expect(querySecurityRoles).toHaveBeenLastCalledWith(expect.objectContaining({ full: false }));
		expect(store.get().securityRoles.mode).toBe('paged');
	});
});
