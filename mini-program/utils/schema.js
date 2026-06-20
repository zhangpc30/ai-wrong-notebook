const { createUuid } = require('./uuid')

const SCHEMA_FIELDS = [
  'id',
  'createdAt',
  'updatedAt',
  'examType',
  'paperType',
  'module',
  'questionType',
  'knowledgePoints',
  'questionText',
  'options',
  'correctAnswer',
  'myAnswer',
  'analysis',
  'standardAnalysis',
  'fastSolution',
  'mistakeReason',
  'trap',
  'similarPattern',
  'reviewSuggestion',
  'difficulty',
  'reviewPriority',
  'masteryLevel',
  'rawModelResponse',
  'multiQuestion',
  'generatedExercises',
  'visualAssumptions',
  'qualityCheck',
  'notes'
]

const EMPTY_ANALYSIS = Object.freeze({
  id: '',
  createdAt: '',
  updatedAt: '',
  examType: '',
  paperType: '',
  module: '',
  questionType: '',
  knowledgePoints: [],
  questionText: '',
  options: [],
  correctAnswer: '',
  myAnswer: '',
  analysis: '',
  standardAnalysis: '',
  fastSolution: '',
  mistakeReason: '',
  trap: '',
  similarPattern: '',
  reviewSuggestion: '',
  difficulty: '',
  reviewPriority: '',
  masteryLevel: 1,
  rawModelResponse: '',
  multiQuestion: {
    detected: false,
    questions: []
  },
  generatedExercises: [],
  visualAssumptions: {
    hasDiagram: false,
    measurements: [],
    solutionBasis: '',
    needsReview: false
  },
  qualityCheck: {
    consistent: true,
    repaired: false,
    needsReview: false,
    warnings: []
  },
  notes: ''
})

function toStringList(value) {
  if (Array.isArray(value)) {
    return value.map(item => String(item).trim()).filter(Boolean)
  }
  return String(value || '')
    .split(/\n|,|，|、/)
    .map(item => item.trim())
    .filter(Boolean)
}

function stringValue(value) {
  return value == null ? '' : String(value).trim()
}

function objectValue(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function normalizeAnalysis(value) {
  const source = objectValue(value)
  const standardAnalysis = stringValue(source.standardAnalysis || source.analysis)
  const analysis = stringValue(source.analysis || source.standardAnalysis)
  const multiQuestion = objectValue(source.multiQuestion)
  const visualAssumptions = objectValue(source.visualAssumptions)
  const qualityCheck = objectValue(source.qualityCheck)
  const mastery = Number(source.masteryLevel || 1)

  return {
    id: stringValue(source.id),
    createdAt: stringValue(source.createdAt),
    updatedAt: stringValue(source.updatedAt),
    examType: stringValue(source.examType),
    paperType: stringValue(source.paperType),
    module: stringValue(source.module),
    questionType: stringValue(source.questionType),
    knowledgePoints: toStringList(source.knowledgePoints),
    questionText: stringValue(source.questionText),
    options: toStringList(source.options),
    correctAnswer: stringValue(source.correctAnswer),
    myAnswer: stringValue(source.myAnswer),
    analysis,
    standardAnalysis,
    fastSolution: stringValue(source.fastSolution),
    mistakeReason: stringValue(source.mistakeReason),
    trap: stringValue(source.trap),
    similarPattern: stringValue(source.similarPattern),
    reviewSuggestion: stringValue(source.reviewSuggestion),
    difficulty: stringValue(source.difficulty),
    reviewPriority: stringValue(source.reviewPriority),
    masteryLevel: Math.max(
      1,
      Math.min(5, Number.isFinite(mastery) ? Math.round(mastery) : 1)
    ),
    rawModelResponse: stringValue(
      source.rawModelResponse || source.rawAiResponse || source.rawResponse
    ),
    multiQuestion: {
      detected: Boolean(multiQuestion.detected),
      questions: Array.isArray(multiQuestion.questions)
        ? multiQuestion.questions
        : []
    },
    generatedExercises: Array.isArray(source.generatedExercises)
      ? source.generatedExercises
      : [],
    visualAssumptions: {
      hasDiagram: Boolean(visualAssumptions.hasDiagram),
      measurements: Array.isArray(visualAssumptions.measurements)
        ? visualAssumptions.measurements
        : [],
      solutionBasis: stringValue(visualAssumptions.solutionBasis),
      needsReview: Boolean(visualAssumptions.needsReview)
    },
    qualityCheck: {
      consistent: qualityCheck.consistent !== false,
      repaired: Boolean(qualityCheck.repaired),
      needsReview: Boolean(qualityCheck.needsReview),
      warnings: toStringList(qualityCheck.warnings)
    },
    notes: stringValue(source.notes)
  }
}

function createRecord(analysis, extras = {}) {
  const now = new Date().toISOString()
  const source = Object.assign({}, analysis, extras)
  const normalized = normalizeAnalysis(source)
  return Object.assign({}, normalized, {
    id: normalized.id || createUuid(),
    createdAt: normalized.createdAt || now,
    updatedAt: now,
    imagePath: stringValue(source.imagePath),
    reviewCount: Number(source.reviewCount || 0),
    lastReviewedAt: stringValue(source.lastReviewedAt)
  })
}

module.exports = {
  SCHEMA_FIELDS,
  EMPTY_ANALYSIS,
  normalizeAnalysis,
  createRecord,
  toStringList
}
