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

  storage.deleteMistake(saved.id)
  assert.equal(storage.getMistake(saved.id), null)
  storage.clearMistakes()
  assert.deepEqual(storage.listMistakes(), [])
})
