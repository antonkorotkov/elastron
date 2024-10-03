/**
 *
 * @param {*} size
 */
export const humanStoreSizeToPseudoBytes = size => {
	const multipliers = {
		b: 1,
		kb: 1000,
		mb: Math.pow(1000, 2),
		gb: Math.pow(1000, 3),
		tb: Math.pow(1000, 4),
	}

	if (typeof size !== 'string') return size

	for (let i in multipliers) {
		const [_, sizeValue] = new RegExp(`^([0-9\.]+?)${i}$`).exec(size) || []

		if (sizeValue) return parseFloat(sizeValue) * multipliers[i]
	}
}

/**
 *
 * @param {*} indexName
 */
export const validateIndexName = indexName => {
	return /^[^-_+ A-Z:\.][a-z0-9\-]*$/.test(indexName)
}

/**
 *
 * @param {*} data
 * @param {*} search
 * @returns
 */
export const filterArrayBy = (data, search) =>
	data.filter(item => {
		for (let col of item) {
			if (col.toLowerCase().indexOf(search.toLowerCase()) > -1) return true
		}
		return false
	})

/**
 *
 * @param {*} theme
 * @returns
 */
export const isThemeToggleChecked = theme => {
	return theme === 'dark' ? true : false
}

/**
 *
 * @param {*} indexData
 * @returns
 */
export const getIndexListFromIndexData = indexData => {
	return indexData.data.map(
		item => item[indexData.columns.reduce((i, item, index) => (item === 'index' ? index : i), 0)]
	)
}

/**
 *
 * @returns
 */
export const randomId = () => {
	return Math.random().toString()
}
