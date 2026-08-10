/**
 * Flattens Elasticsearch mapping properties into dotted field paths.
 * @param {object} properties 
 * @param {string} prefix 
 * @returns {string[]}
 */
export const flattenProperties = (properties, prefix = '') => {
	let fields = []
	if (!properties || typeof properties !== 'object') return fields

	for (const [key, value] of Object.entries(properties)) {
		const fullPath = prefix ? `${prefix}.${key}` : key
		if (value && typeof value === 'object' && value.properties) {
			fields.push(fullPath)
			fields.push(...flattenProperties(value.properties, fullPath))
		} else {
			fields.push(fullPath)
		}
	}
	return fields
}

/**
 * Flattens a document source object into dotted field paths.
 * @param {object} obj 
 * @param {string} prefix 
 * @returns {string[]}
 */
export const flattenObject = (obj, prefix = '') => {
	let fields = []
	if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return fields

	for (const [key, value] of Object.entries(obj)) {
		const fullPath = prefix ? `${prefix}.${key}` : key
		if (value && typeof value === 'object' && !Array.isArray(value)) {
			fields.push(fullPath)
			fields.push(...flattenObject(value, fullPath))
		} else {
			fields.push(fullPath)
		}
	}
	return fields
}

/**
 * Compiles a list of unique available fields from both index mappings and search results hits.
 * @param {object} indexInfo 
 * @param {object[]} hits 
 * @returns {string[]}
 */
export const getAvailableFields = (indexInfo, hits) => {
	const fields = new Set()

	// 1. Extract from index mappings
	if (indexInfo && typeof indexInfo === 'object') {
		for (const indexKey of Object.keys(indexInfo)) {
			const mappings = indexInfo[indexKey]?.mappings
			if (mappings) {
				const properties = mappings.properties || mappings._doc?.properties
				if (properties) {
					const flattened = flattenProperties(properties)
					for (const f of flattened) {
						fields.add(f)
					}
				}
			}
		}
	}

	// 2. Extract from search results hits
	if (Array.isArray(hits)) {
		for (const hit of hits) {
			if (hit._source) {
				const flattened = flattenObject(hit._source)
				for (const f of flattened) {
					fields.add(f)
				}
			}
		}
	}

	return Array.from(fields).sort()
}

/**
 * Formats objects/arrays into a compact, truncated JSON string representation.
 * @param {any} value 
 * @param {number} maxLen 
 * @returns {string}
 */
export const formatCompactJSON = (value, maxLen = 60) => {
	if (value === null || value === undefined) return ''
	if (typeof value === 'object') {
		try {
			const str = JSON.stringify(value)
			if (str.length > maxLen) {
				return str.substring(0, maxLen - 3) + '...'
			}
			return str
		} catch (e) {
			return String(value)
		}
	}
	return String(value)
}
