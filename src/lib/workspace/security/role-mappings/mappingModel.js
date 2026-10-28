/**
 * The mapping editor holds the cluster's full mapping and applies the form's
 * rules onto it, as the role editor does for roles. Rules are rebuilt only
 * when the user touched them, so a mapping whose rules the form cannot show is
 * sent back exactly as it came.
 */

/** What the list adds to an entry, which the cluster would refuse. */
const LIST_FIELDS = ['name', 'readOnly', 'usesTemplates', 'rulesText']

export const toWritableMapping = mapping => {
	const draft = { ...(mapping || {}) }
	for (const field of LIST_FIELDS) delete draft[field]

	if (draft.metadata && typeof draft.metadata === 'object') {
		// Elasticsearch rejects metadata keys beginning with an underscore; it
		// sets `_read_only` itself.
		const metadata = Object.fromEntries(
			Object.entries(draft.metadata).filter(([key]) => !key.startsWith('_'))
		)
		if (Object.keys(metadata).length) draft.metadata = metadata
		else delete draft.metadata
	}

	return draft
}

export const FIELDS = [
	{ value: 'groups', label: 'Group' },
	{ value: 'realm.name', label: 'Realm name' },
	{ value: 'username', label: 'Username' },
	{ value: 'dn', label: 'Distinguished name' },
	{ value: 'metadata', label: 'Metadata' },
]

const PLAIN_FIELDS = new Set(FIELDS.map(f => f.value).filter(value => value !== 'metadata'))

export const emptyCondition = () => ({ field: 'groups', key: '', values: [] })

export const emptyRulesForm = () => ({ kind: 'all', conditions: [emptyCondition()], exception: null })

export const emptyMapping = () => ({ enabled: true, roles: [] })

const toCondition = node => {
	const entries = Object.entries(node?.field || {})
	if (entries.length !== 1) return null
	const [[name, value]] = entries
	const values = Array.isArray(value) ? value : [value]

	if (PLAIN_FIELDS.has(name)) return { field: name, key: '', values }
	const key = name.startsWith('metadata.') ? name.slice('metadata.'.length) : ''
	return key ? { field: 'metadata', key, values } : null
}

/** The form state for these rules, or null when the form cannot show them. */
export const parseRules = rules => {
	if (rules?.field) {
		const condition = toCondition(rules)
		return condition && { kind: 'all', conditions: [condition], exception: null }
	}

	const kind = Array.isArray(rules?.all) ? 'all' : Array.isArray(rules?.any) ? 'any' : null
	if (!kind || !rules[kind].length) return null

	const conditions = []
	let exception = null
	for (const node of rules[kind]) {
		if (node?.field) {
			const condition = toCondition(node)
			if (!condition) return null
			conditions.push(condition)
		} else if (node?.except && kind === 'all' && !exception) {
			exception = toCondition(node.except)
			if (!exception) return null
		} else {
			return null
		}
	}

	return conditions.length ? { kind, conditions, exception } : null
}

const toField = ({ field, key, values }) => ({
	field: {
		[field === 'metadata' ? `metadata.${key.trim()}` : field]: values.length === 1 ? values[0] : values,
	},
})

export const buildRules = form => {
	const nodes = form.conditions.map(toField)
	if (form.exception) nodes.push({ except: toField(form.exception) })
	return nodes.length === 1 ? nodes[0] : { [form.kind]: nodes }
}

export const applyRules = (mapping, form) => ({ ...mapping, rules: buildRules(form) })

const conditionProblem = condition => {
	if (condition.field === 'metadata' && !condition.key.trim()) return 'A metadata condition needs a key.'
	if (!condition.values.length) return 'Each condition needs at least one value.'
	return null
}

/** Why the form cannot be saved as it stands, or null. */
export const rulesProblem = form => {
	if (!form.conditions.length) return 'A mapping needs at least one condition.'
	if (form.exception && form.kind !== 'all') {
		return 'Elasticsearch only accepts an exception when all conditions must hold.'
	}
	for (const condition of [...form.conditions, ...(form.exception ? [form.exception] : [])]) {
		const problem = conditionProblem(condition)
		if (problem) return problem
	}
	return null
}
