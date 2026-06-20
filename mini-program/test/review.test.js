const test = require('node:test')
const assert = require('node:assert/strict')

const {
  isDue,
  getReviewQueue,
  buildStudyStats
} = require('../utils/review')

const now = new Date('2026-06-20T12:00:00.000Z')

test('builds a due review queue ordered by weakness and priority', () => {
  const questions = [
    {
      id: 'mastered',
      masteryLevel: 5,
      reviewPriority: '高',
      lastReviewedAt: '2026-06-01T00:00:00.000Z'
    },
    {
      id: 'weak',
      masteryLevel: 1,
      reviewPriority: '高',
      lastReviewedAt: '2026-06-18T00:00:00.000Z'
    },
    {
      id: 'medium',
      masteryLevel: 3,
      reviewPriority: '中',
      lastReviewedAt: '2026-06-10T00:00:00.000Z'
    }
  ]

  assert.equal(isDue(questions[0], now), false)
  assert.equal(isDue(questions[1], now), true)
  assert.deepEqual(
    getReviewQueue(questions, now).map(item => item.id),
    ['weak', 'medium']
  )
})

test('summarizes mastery, favorites and module distribution', () => {
  const stats = buildStudyStats([
    {
      masteryLevel: 4,
      reviewCount: 2,
      isFavorite: true,
      module: '判断推理',
      lastReviewedAt: '2026-06-20T00:00:00.000Z'
    },
    {
      masteryLevel: 2,
      reviewCount: 0,
      module: '判断推理'
    },
    {
      masteryLevel: 5,
      reviewCount: 1,
      module: '资料分析'
    }
  ], now)

  assert.equal(stats.total, 3)
  assert.equal(stats.mastered, 2)
  assert.equal(stats.masteryRate, 67)
  assert.equal(stats.favorites, 1)
  assert.equal(stats.moduleRanking[0].name, '判断推理')
})
