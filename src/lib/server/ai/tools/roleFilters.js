// Which roles grant what, judged from the role definitions alone. The cluster
// cannot search index patterns or privileges, so these run over the whole list.

const escapeRegExp = text => text.replace(/[.*+?^${}()|[\]\\/-]/g, '\\$&')

const globMatches = (pattern, target) =>
	new RegExp(`^${pattern.split('').map(c => (c === '*' ? '.*' : c === '?' ? '.' : escapeRegExp(c))).join('')}$`).test(target)

// Operators Lucene regular expressions have and JavaScript's do not. A pattern
// using one outside a whole-branch complement is skipped, not guessed at.
const LUCENE_ONLY = new Set(['~', '&', '<', '>', '@', '#'])

// In Lucene a backslash makes the next character literal, so `\d` is the
// letter d, not a digit class as in JavaScript.
const literal = char => (/[a-zA-Z0-9]/.test(char) ? char : `\\${char}`)

// Rewrites a Lucene regular expression as a JavaScript one, or null when it
// uses something JavaScript cannot express the same way.
const toJavaScript = body => {
	let out = ''
	for (let i = 0; i < body.length; i += 1) {
		const char = body[i]
		if (char === '\\') {
			if (i + 1 >= body.length) return null
			out += literal(body[++i])
		} else if (char === '"') {
			const end = body.indexOf('"', i + 1)
			if (end === -1) return null
			out += escapeRegExp(body.slice(i + 1, end))
			i = end
		} else if (char === '[') {
			let j = i + 1
			let set = '['
			if (body[j] === '^') set += body[j++]
			for (; j < body.length && body[j] !== ']'; j += 1) {
				if (body[j] === '\\') {
					if (j + 1 >= body.length) return null
					set += literal(body[++j])
				} else set += body[j] === '[' ? '\\[' : body[j]
			}
			if (j >= body.length) return null
			out += `${set}]`
			i = j
		} else if (char === '^' || char === '$') {
			out += `\\${char}`
		} else if (LUCENE_ONLY.has(char)) {
			return null
		} else {
			out += char
		}
	}
	return out
}

// Walks a pattern at its top level, skipping escapes, quoted strings, and
// character classes. Returns the top-level `|` positions and where each
// opening parenthesis closes, or null when the pattern is unbalanced.
const scan = body => {
	const bars = []
	const closes = new Map()
	const open = []
	for (let i = 0; i < body.length; i += 1) {
		const char = body[i]
		if (char === '\\') i += 1
		else if (char === '"') {
			i = body.indexOf('"', i + 1)
			if (i === -1) return null
		} else if (char === '[') {
			i += 1
			while (i < body.length && body[i] !== ']') i += body[i] === '\\' ? 2 : 1
			if (i >= body.length) return null
		} else if (char === '(') open.push(i)
		else if (char === ')') {
			if (!open.length) return null
			closes.set(open.pop(), i)
		} else if (char === '|' && !open.length) bars.push(i)
	}
	return open.length ? null : { bars, closes }
}

const branchMatches = (branch, target) => {
	// `~(...)` spanning a whole branch is Lucene's complement, which the
	// builtin roles use to mean "everything but hidden indices".
	const layout = scan(branch)
	if (layout && branch.startsWith('~(') && layout.closes.get(1) === branch.length - 1) {
		const inner = luceneMatches(branch.slice(2, -1), target)
		return inner === null ? null : !inner
	}
	// A group spanning the whole branch only groups, so look inside it.
	if (layout && branch.startsWith('(') && layout.closes.get(0) === branch.length - 1) {
		return luceneMatches(branch.slice(1, -1), target)
	}
	const source = toJavaScript(branch)
	if (source === null) return null
	try {
		return new RegExp(`^(?:${source})$`).test(target)
	} catch {
		return null
	}
}

// true, false, or null when the pattern cannot be read faithfully.
const luceneMatches = (body, target) => {
	const layout = scan(body)
	if (!layout) return null
	const cuts = [-1, ...layout.bars, body.length]
	const results = cuts.slice(1).map((end, i) => branchMatches(body.slice(cuts[i] + 1, end), target))
	if (results.includes(true)) return true
	return results.includes(null) ? null : false
}

/** Whether an index pattern from a role covers the given index name. */
export const patternCovers = (pattern, target) => {
	if (pattern === target) return true
	if (pattern.length > 2 && pattern.startsWith('/') && pattern.endsWith('/')) {
		return luceneMatches(pattern.slice(1, -1), target) === true
	}
	return /[*?]/.test(pattern) && globMatches(pattern, target)
}

// `all` grants every privilege of its own kind: a cluster `all` says nothing
// about index access, and an index `all` nothing about cluster actions. The
// kinds come from the cluster's builtin privilege lists; without them, `all`
// counts only for itself. Other implications, such as `write` covering
// `index`, are not published by Elasticsearch in a form the app could read.
const holds = (privileges, privilege, known) =>
	(privileges || []).includes(privilege) ||
	((privileges || []).includes('all') && Boolean(known?.has(privilege)))

/**
 * Whether a role grants `privilege` (cluster or index), on `index` when given.
 * Both must hold on the same index entry, so a role that reads logs-* and
 * writes elsewhere does not grant write on logs-*. `kinds` holds the cluster's
 * builtin cluster and index privilege names as sets.
 */
export const roleGrants = (role, { index, privilege } = {}, kinds = {}) => {
	const blocks = role?.indices || []
	if (!index) {
		return (
			holds(role?.cluster, privilege, kinds.cluster) ||
			blocks.some(block => holds(block?.privileges, privilege, kinds.index))
		)
	}
	return blocks.some(
		block =>
			(block?.names || []).some(pattern => patternCovers(pattern, index)) &&
			(!privilege || holds(block?.privileges, privilege, kinds.index))
	)
}
