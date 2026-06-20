const test = require('node:test')
const assert = require('node:assert/strict')

const {
  SCHEMA_FIELDS,
  normalizeAnalysis,
  createRecord
} = require('../utils/schema')

test('normalizes backend JSON to the shared schema', () => {
  const result = normalizeAnalysis({
    examType: '国考',
    knowledgePoints: ['削弱论证'],
    options: 'A. 甲\nB. 乙',
    masteryLevel: 9,
    unexpected: 'removed'
  })

  assert.equal(Object.keys(result).length, SCHEMA_FIELDS.length)
  assert.equal(result.examType, '国考')
  assert.deepEqual(result.options, ['A. 甲', 'B. 乙'])
  assert.equal(result.masteryLevel, 5)
  assert.equal(result.unexpected, undefined)
  assert.deepEqual(result.multiQuestion, {
    detected: false,
    questions: []
  })
  assert.deepEqual(result.generatedExercises, [])
  assert.equal(result.qualityCheck.consistent, true)
})

test('keeps analysis aliases and advanced fields safe when backend is partial', () => {
  const fromAnalysis = normalizeAnalysis({
    questionText: '题干',
    analysis: '基础解析',
    rawAiResponse: '{"answer":"A"}'
  })
  assert.equal(fromAnalysis.standardAnalysis, '基础解析')
  assert.equal(fromAnalysis.analysis, '基础解析')
  assert.equal(fromAnalysis.rawModelResponse, '{"answer":"A"}')

  const fromStandard = normalizeAnalysis({
    standardAnalysis: '标准解析',
    qualityCheck: {
      consistent: false,
      needsReview: true,
      warnings: '答案需要核对'
    }
  })
  assert.equal(fromStandard.analysis, '标准解析')
  assert.equal(fromStandard.qualityCheck.needsReview, true)
  assert.deepEqual(fromStandard.qualityCheck.warnings, ['答案需要核对'])
})

test('creates a locally storable wrong-question record', () => {
  const record = createRecord({
    questionText: '以下哪项最能削弱？',
    masteryLevel: 2
  })

  assert.match(record.id, /^q_/)
  assert.equal(record.questionText, '以下哪项最能削弱？')
  assert.equal(record.reviewCount, 0)
  assert.equal(record.imagePath, '')
  assert.ok(record.createdAt)
})
