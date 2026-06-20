const test = require('node:test')
const assert = require('node:assert/strict')

function createStorageHarness(initial = {}) {
  const values = new Map(Object.entries(initial))
  global.wx = {
    getStorageSync(key) {
      return values.get(key)
    },
    setStorageSync(key, value) {
      values.set(key, value)
    },
    removeStorageSync(key) {
      values.delete(key)
    }
  }
  delete require.cache[require.resolve('../utils/storage')]
  return {
    storage: require('../utils/storage'),
    values
  }
}

test('migrates legacy questions and supports mistake CRUD in updated order', () => {
  const { storage, values } = createStorageHarness({
    public_exam_questions_v1: [
      {
        id: 'legacy-1',
        questionText: '旧错题',
        imagePath: '/tmp/question.jpg',
        createdAt: '2026-06-01T00:00:00.000Z',
        updatedAt: '2026-06-01T00:00:00.000Z'
      }
    ]
  })

  assert.equal(storage.listMistakes().length, 1)
  assert.equal(values.has('mistakes'), true)
  assert.equal(storage.getMistake('legacy-1').imagePath, '/tmp/question.jpg')

  const saved = storage.saveMistake({
    questionText: '新错题',
    masteryLevel: 2,
    notes: '复习'
  })
  assert.ok(saved.id)
  assert.equal(storage.listMistakes()[0].id, saved.id)

  const updated = storage.updateMistake(saved.id, {
    masteryLevel: 4,
    notes: '已理解'
  })
  assert.equal(updated.masteryLevel, 4)
  assert.equal(updated.notes, '已理解')

  const favorite = storage.toggleFavorite(saved.id)
  assert.equal(favorite.isFavorite, true)

  const reviewed = storage.markReviewed(saved.id, 5)
  assert.equal(reviewed.masteryLevel, 5)
  assert.equal(reviewed.reviewCount, 1)
  assert.ok(reviewed.lastReviewedAt)

  const another = storage.saveMistake({ questionText: '批量删除题' })
  storage.deleteMistakes([saved.id, another.id])
  assert.equal(storage.getMistake(another.id), null)
  assert.equal(storage.listDeletions().length, 2)

  const cloud = storage.applyCloudSnapshot({
    items: [{
      id: 'cloud-1',
      questionText: '云端错题',
      cloudImageUrl: 'https://example.com/question.jpg',
      createdAt: '2026-06-20T00:00:00.000Z',
      updatedAt: '2026-06-20T00:00:00.000Z'
    }],
    deletions: []
  })
  assert.equal(cloud[0].imagePath, 'https://example.com/question.jpg')
  assert.deepEqual(storage.listDeletions(), [])

  storage.deleteMistake(saved.id)
  assert.equal(storage.getMistake(saved.id), null)
  storage.clearMistakes()
  assert.deepEqual(storage.listMistakes(), [])
})
