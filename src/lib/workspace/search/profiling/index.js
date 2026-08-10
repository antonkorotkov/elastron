import PercentToHex from 'percent-to-hex'
import { compare } from 'compare-versions'

/**
 * Convert nanos to milliseconds
 */
export const getTimeMillis = time => time / 1000000

/**
 * Get color by time pomraring to other times
 */
export const getTimeColor = (time, times) => {
	let total = 0
	if (times && times.length) {
		total = times.reduce((sum, item) => sum + item, 0)
	}
	return PercentToHex([time / total, 70, 60])
}

/**
 * Get nanos from string milliseconds
 */
export const getNanosFromMsString = string => parseFloat(string) * 1000000

/**
 * Elasticsearch below 5.0 used a different shape for the profile response.
 * The version is unknown until the connection test resolves, so anything
 * `compare` cannot parse is treated as a modern server.
 */
export const isLegacyProfile = version => {
	try {
		return compare(version, '5.0.0', '<')
	} catch {
		return false
	}
}

export default {
	query(q) {
		return {
			getType: v => (isLegacyProfile(v) ? q.query_type : q.type),
			getDescription: v => (isLegacyProfile(v) ? q.lucene : q.description),
			getNanos: v =>
				isLegacyProfile(v)
					? getNanosFromMsString(q.time)
					: q.time_in_nanos || 0,
		}
	},
	collector(c) {
		return {
			getName: () => c.name,
			getReason: () => c.reason,
			getNanos: v =>
				isLegacyProfile(v)
					? getNanosFromMsString(c.time)
					: c.time_in_nanos || 0,
		}
	},
}
