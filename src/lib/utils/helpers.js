import get from "lodash/get"

/**
 * @param {string} size
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
        const [, sizeValue] = new RegExp(`^([0-9\\.]+?)${i}$`).exec(size) ?? []

        if (sizeValue) return parseFloat(sizeValue) * multipliers[i]
    }
}

/**
 * @param {string} indexName
 */
export const isIndexNameValid = indexName => /^[a-z0-9\-_]+$/.test(indexName)

/**
 * Elasticsearch reports its version as `{ number: '8.12.0', ... }`, but it is
 * passed around as the bare number string. Accept either and return the string,
 * or null when the server did not report one.
 *
 * @param {object|string} version
 * @returns {string|null}
 */
export const getVersionNumber = version => {
    if (version && typeof version === 'object') version = version.number
    return typeof version === 'string' && version ? version : null
}

/**
 * @param {array} data
 * @param {string} search
 * @returns {array}
 */
export const filterArrayBy = (data, search) =>
    data.filter(item => {
        for (let col of item) {
            if (col.toLowerCase().indexOf(search.toLowerCase()) > -1) return true
        }
        return false
    })

/**
 * @param {string} theme
 * @returns {boolean}
 */
export const isThemeToggleChecked = theme => {
    return theme === 'dark' ? true : false
}

/**
 * @param {*} indexData
 * @returns
 */
export const getIndexListFromIndexData = indexData => {
    return indexData.data.map(
        item => item[indexData.columns.reduce((i, item, index) => (item === 'index' ? index : i), 0)]
    )
}

/**
 * @returns {string}
 */
export const randomId = () => {
    return Math.random().toString()
}

/**
 * @param {Error} error
 * @returns {string}
 */
export const getMessageFromError = error => {
    const message = get(
        error,
        'response.data.error.root_cause[0].reason',
        get(error, 'response.data.error.reason', error.message)
    ).replace("Error invoking remote method 'elastic-request': ", '');

    return message;
}

/**
 * @param {string} column
 * @param {number} index
 * @returns {(o: object) => number}
 */
export const indicesSortPredicate = (column, index) => o => {
    switch (column) {
        case 'docs.count':
        case 'docs.deleted':
        case 'pri':
        case 'rep':
            return Number(o[index])
        case 'pri.store.size':
        case 'store.size':
            return humanStoreSizeToPseudoBytes(o[index])
        default:
            return o[index]
    }
}

/**
 * @param {string} column
 * @param {number} index
 * @returns {(o: object) => number}
 */
export const shardsSortPredicate = (column, index) => o => {
    switch (column) {
        case 'shard':
        case 'docs':
            return Number(o[index])
        case 'store':
            return humanStoreSizeToPseudoBytes(o[index])
        default:
            return o[index]
    }
}

/**
 * @param {string} column
 * @param {number} index
 * @returns {(o: object) => number}
 */
export const allocationSortPredicate = (column, index) => o => {
    switch (column) {
        case 'shards':
        case 'disk.percent':
            return Number(o[index])
        case 'disk.indices':
        case 'disk.used':
        case 'disk.avail':
        case 'disk.total':
            return humanStoreSizeToPseudoBytes(o[index])
        default:
            return o[index]
    }
}

/**
 * Parse JSON typed into an editor, treating an empty document as `{}`.
 * Throws a SyntaxError on malformed input — callers report it to the user.
 *
 * @param {string} text
 * @returns {any}
 */
export const parseJsonBody = (text = '') => {
    const trimmed = (text || '').trim()
    return trimmed ? JSON.parse(trimmed) : {}
}

/**
 * @param {Error} error
 * @returns {string} notification message for an unparseable request body
 */
export const invalidJsonBodyMessage = error =>
    `Request body is not valid JSON: ${error.message}`
