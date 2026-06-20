function createUuid(prefix = 'q') {
  const random = Math.random().toString(36).slice(2, 10)
  return `${prefix}_${Date.now()}_${random}`
}

module.exports = {
  createUuid
}
