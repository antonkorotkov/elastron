// Older clusters, and clusters with security off, answer a security query
// endpoint they do not have with a bare "no handler found" string.
export const lacksQueryEndpoint = (err, entity) => {
	const body = err?.meta?.body?.error;
	const reason = typeof body === 'string' ? body : body?.reason || err?.message || '';
	return new RegExp(`no handler found for uri \\[\\/?_security\\/_query\\/${entity}`, 'i').test(reason);
};
