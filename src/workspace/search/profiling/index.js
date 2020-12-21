import PercentToHex from 'percent-to-hex'
import versions from 'compare-versions'

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
    total = times.reduce((sum, item) => sum + item.time_in_nanos, 0)
  }
  return PercentToHex([time / total, 70, 60])
}

/**
 * Get nanos from string milliseconds
 */
export const getNanosFromMsString = string => parseFloat(string) * 1000000

export default {
  query(q) {
    return {
      getType: v => (versions.compare(v, '5.0.0', '<') ? q.query_type : q.type),
      getDescription: v =>
        versions.compare(v, '5.0.0', '<') ? q.lucene : q.description,
      getNanos: v =>
        versions.compare(v, '5.0.0', '<')
          ? getNanosFromMsString(q.time)
          : q.time_in_nanos || 0,
    }
  },
  collector(c) {
    return {
      getName: v => c.name,
      getReason: v => c.reason,
      getNanos: v =>
        versions.compare(v, '5.0.0', '<')
          ? getNanosFromMsString(c.time)
          : c.time_in_nanos || 0,
    }
  },
}
