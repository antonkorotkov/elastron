/**
 * The role editor holds the cluster's full role definition and applies
 * structured edits onto it.
 *
 * This matters more than it looks. A role carries fields the structured form
 * does not model, such as `applications`, `global`, `remote_indices` and
 * `remote_cluster`. Rebuilding a role from form fields on save would drop
 * them silently. On the Enterprise cluster seen during design every one of the
 * 116 custom roles carried a document query, so a lossy round trip would be
 * the normal path there, not a rare edge case.
 */

/** Fields Elasticsearch returns but refuses on write. */
const READ_ONLY_FIELDS = ['transient_metadata']

/** Strips what the cluster will not accept back, leaving everything else. */
export const toWritableRole = role => {
	const draft = { ...(role || {}) }
	for (const field of READ_ONLY_FIELDS) delete draft[field]
	// The name is the URL, not part of the body, and `_reserved` and the
	// derived flags the list adds are ours, not the cluster's.
	delete draft.name
	delete draft.reserved
	delete draft.hasDocumentQuery
	delete draft.hasFieldSecurity

	if (draft.metadata && typeof draft.metadata === 'object') {
		// Elasticsearch rejects metadata keys beginning with an underscore; it
		// sets them itself on reserved roles.
		const metadata = Object.fromEntries(
			Object.entries(draft.metadata).filter(([key]) => !key.startsWith('_'))
		)
		if (Object.keys(metadata).length) draft.metadata = metadata
		else delete draft.metadata
	}

	return draft
}

/** Applies one structured edit onto the full definition, leaving the rest. */
export const applyEdit = (role, patch) => ({ ...role, ...patch })

/** An empty role, shaped the way the cluster returns one. */
export const emptyRole = () => ({ cluster: [], indices: [], run_as: [] })

/** A fresh index privilege block. */
export const emptyIndexBlock = () => ({ names: [], privileges: [] })

/**
 * Whether the definition carries anything the structured form cannot show.
 * The editor uses this to tell the user their role has more to it than the
 * form displays, rather than letting them assume the form is the whole thing.
 */
const MODELLED_FIELDS = new Set(['cluster', 'indices', 'run_as', 'metadata', 'description'])

export const unmodelledFields = role =>
	Object.keys(role || {})
		.filter(key => !MODELLED_FIELDS.has(key))
		.filter(key => {
			const value = role[key]
			if (value == null) return false
			if (Array.isArray(value)) return value.length > 0
			if (typeof value === 'object') return Object.keys(value).length > 0
			return true
		})
		.sort()

/** Whether any index block restricts documents or fields. */
export const usesDocumentOrFieldSecurity = role =>
	(role?.indices || []).some(block => block?.query || block?.field_security)

/** Splits a comma or newline separated list into trimmed, non-empty entries. */
export const parseList = text =>
	String(text || '')
		.split(/[\n,]/)
		.map(entry => entry.trim())
		.filter(Boolean)
