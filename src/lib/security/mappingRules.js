// How a role mapping's rules read as one line, shared by the list, its search,
// and the assistant, so all three describe a mapping the same way.

export const READ_ONLY_MAPPING_SUFFIX = '-read-only-operator-mapping';

// Mappings from operator file-based settings carry both marks; either is enough.
export const isReadOnlyMapping = (name, mapping) =>
	Boolean(mapping?.metadata?._read_only) || String(name || '').endsWith(READ_ONLY_MAPPING_SUFFIX);

/** Shows a value the way it was typed, keeping null and numbers recognisable. */
export const formatValue = value => (typeof value === 'string' ? value : JSON.stringify(value));

const describeField = field => {
	const [[name, value] = []] = Object.entries(field || {});
	if (name === undefined) return '?';
	if (!Array.isArray(value)) return `${name} = ${formatValue(value)}`;
	if (value.length === 1) return `${name} = ${formatValue(value[0])}`;
	return `${name} in (${value.map(formatValue).join(', ')})`;
};

const describeNode = (rule, nested) => {
	if (rule?.field) return describeField(rule.field);
	if (rule?.except) return `NOT ${describeNode(rule.except, true)}`;

	const kind = rule?.all ? 'all' : rule?.any ? 'any' : null;
	if (!kind) return '?';

	const children = rule[kind];
	// An empty all holds for everyone and an empty any for no one.
	if (!children.length) return kind === 'all' ? 'always' : 'never';
	if (children.length === 1) return describeNode(children[0], nested);

	const text = children.map(child => describeNode(child, true)).join(kind === 'all' ? ' AND ' : ' OR ');
	return nested ? `(${text})` : text;
};

export const describeRules = rules => (rules ? describeNode(rules, false) : '');
