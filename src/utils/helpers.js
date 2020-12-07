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
 * @param {*} e
 * @param {*} className
 */
export const classToggle = (e, className) => {
  e.target.classList.toggle(className)
}

/**
 *
 * @param {*} indexName
 */
export const validateIndexName = indexName => {
  return /^[^-_+ A-Z:\.][a-z0-9\-]*$/.test(indexName)
}

export const filterArrayBy = (data, search) =>
  data.filter(item => {
    for (let col of item) {
      if (col.toLowerCase().indexOf(search.toLowerCase()) > -1) return true
    }
    return false
  })
