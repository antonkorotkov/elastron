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
 * Preset colors offered when tagging a connection. Taken from the Semantic UI
 * palette so they sit well next to the rest of the chrome, and written in the
 * lowercase 6-digit form `<input type="color">` hands back — a preset and the
 * native picker must produce byte-identical strings, or the deep-equality
 * identity in the connections store sees two colors as two different connections.
 * Semantic's `black` (#1b1c1d) is deliberately absent: it is the exact header
 * background, so it renders as an invisible strip and an unreadable pill.
 */
export const CONNECTION_COLORS = [
    '#db2828', // red
    '#f2711c', // orange
    '#fbbd08', // yellow
    '#21ba45', // green
    '#00b5ad', // teal
    '#2185d0', // blue
    '#a333c8', // purple
    '#767676', // grey
]

/**
 * Parse anything a user might paste into the hex field — with or without the
 * leading `#`, in either case, 3-digit or 6-digit — into the canonical
 * lowercase `#rrggbb` form. Returns null when the input is not a color, so
 * callers can simply decline to commit it.
 *
 * @param {string} input
 * @returns {string|null}
 */
export const normalizeHex = input => {
    if (typeof input !== 'string') return null

    const hex = input.trim().replace(/^#/, '').toLowerCase()

    if (/^[0-9a-f]{3}$/.test(hex))
        return '#' + [...hex].map(char => char + char).join('')

    if (/^[0-9a-f]{6}$/.test(hex)) return '#' + hex

    return null
}

/**
 * @param {string} channel two hex digits
 * @returns {number} the channel's contribution to relative luminance
 */
const channelLuminance = channel => {
    const value = parseInt(channel, 16) / 255
    return value <= 0.03928
        ? value / 12.92
        : Math.pow((value + 0.055) / 1.055, 2.4)
}

/**
 * Pick black or white text for an arbitrary background, whichever gives the
 * better WCAG contrast ratio. Users can assign any color to a connection, so
 * the text color on the header pill can never be hardcoded.
 *
 * @param {string} color
 * @returns {string} '#000' or '#fff'
 */
export const contrastTextColor = color => {
    const hex = normalizeHex(color)
    if (!hex) return '#fff'

    const luminance =
        0.2126 * channelLuminance(hex.slice(1, 3)) +
        0.7152 * channelLuminance(hex.slice(3, 5)) +
        0.0722 * channelLuminance(hex.slice(5, 7))

    const contrastWithBlack = (luminance + 0.05) / 0.05
    const contrastWithWhite = 1.05 / (luminance + 0.05)

    return contrastWithBlack > contrastWithWhite ? '#000' : '#fff'
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

/**
 * Reads the request body straight out of a JSON editor so a caller never acts
 * on a body the user has since edited. Falls back to the last known good body
 * when no editor is mounted, and returns `{ error }` on malformed JSON.
 *
 * @param {{ getText?: () => string }} editor
 * @param {object} fallback
 * @returns {{ requestBody?: object, error?: Error }}
 */
export const readEditorJson = (editor, fallback = {}) => {
    if (!editor || typeof editor.getText !== 'function')
        return { requestBody: fallback }

    try {
        return { requestBody: parseJsonBody(editor.getText()) }
    } catch (error) {
        return { error }
    }
}
