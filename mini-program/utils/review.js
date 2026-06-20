const REVIEW_INTERVAL_DAYS = [0, 1, 2, 4, 7, 14]

function startOfDay(value) {
  const date = new Date(value)
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

function daysBetween(from, to) {
  return Math.floor((startOfDay(to) - startOfDay(from)) / 86400000)
}

function isDue(item, now = new Date()) {
  const mastery = Math.max(1, Math.min(5, Number(item.masteryLevel || 1)))
  if (mastery >= 5) return false
  if (!item.lastReviewedAt) return true
  return daysBetween(item.lastReviewedAt, now) >= REVIEW_INTERVAL_DAYS[mastery]
}

function reviewScore(item, now = new Date()) {
  const priority = { 高: 30, 中: 18, 低: 8 }[item.reviewPriority] || 12
  const mastery = Math.max(1, Math.min(5, Number(item.masteryLevel || 1)))
  const overdue = item.lastReviewedAt
    ? Math.max(0, daysBetween(item.lastReviewedAt, now) - REVIEW_INTERVAL_DAYS[mastery])
    : 14
  return priority + (6 - mastery) * 8 + Math.min(overdue, 20) + (item.isFavorite ? 3 : 0)
}

function getReviewQueue(items, now = new Date()) {
  return (Array.isArray(items) ? items : [])
    .filter(item => isDue(item, now))
    .map(item => ({ ...item, reviewScore: reviewScore(item, now) }))
    .sort((a, b) => b.reviewScore - a.reviewScore)
}

function buildStudyStats(items, now = new Date()) {
  const list = Array.isArray(items) ? items : []
  const mastered = list.filter(item => Number(item.masteryLevel) >= 4).length
  const reviewed = list.filter(item => Number(item.reviewCount || 0) > 0).length
  const favorites = list.filter(item => item.isFavorite).length
  const due = getReviewQueue(list, now).length
  const masteryRate = list.length ? Math.round(mastered * 100 / list.length) : 0

  const moduleCounts = {}
  list.forEach(item => {
    const module = item.module || '未分类'
    moduleCounts[module] = (moduleCounts[module] || 0) + 1
  })
  const moduleRanking = Object.keys(moduleCounts)
    .map(name => ({ name, count: moduleCounts[name] }))
    .sort((a, b) => b.count - a.count)

  return {
    total: list.length,
    mastered,
    reviewed,
    favorites,
    due,
    masteryRate,
    moduleRanking
  }
}

module.exports = {
  REVIEW_INTERVAL_DAYS,
  daysBetween,
  isDue,
  reviewScore,
  getReviewQueue,
  buildStudyStats
}
