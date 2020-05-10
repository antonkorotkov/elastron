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
