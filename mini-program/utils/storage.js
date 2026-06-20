const { createRecord, normalizeAnalysis } = require('./schema')

const MISTAKES_KEY = 'mistakes'
const LEGACY_QUESTIONS_KEY = 'public_exam_questions_v1'

function normalizeAndSort(items) {
  return items
    .map(item => {
      const normalized = normalizeAnalysis(item)
      const now = new Date().toISOString()
      return Object.assign({}, normalized, {
        id: normalized.id || createRecord(normalized).id,
        createdAt: normalized.createdAt || now,
        updatedAt: normalized.updatedAt || normalized.createdAt || now,
        imagePath: String(item.imagePath || ''),
        reviewCount: Number(item.reviewCount || 0),
        lastReviewedAt: String(item.lastReviewedAt || '')
      })
    })
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
}

function listMistakes() {
  const current = wx.getStorageSync(MISTAKES_KEY)
  if (Array.isArray(current)) return normalizeAndSort(current)

  const legacy = wx.getStorageSync(LEGACY_QUESTIONS_KEY)
  if (Array.isArray(legacy)) {
    const migrated = normalizeAndSort(legacy)
    wx.setStorageSync(MISTAKES_KEY, migrated)
    return migrated
  }
  return []
}

function writeMistakes(items) {
  const normalized = normalizeAndSort(items)
  wx.setStorageSync(MISTAKES_KEY, normalized)
  return normalized
}

function getMistake(id) {
  return listMistakes().find(item => item.id === id) || null
}

function saveMistake(item) {
  const items = listMistakes()
  const existing = item && item.id ? getMistake(item.id) : null
  const saved = createRecord(Object.assign({}, existing || {}, item, {
    createdAt: existing ? existing.createdAt : item.createdAt
  }))
  const next = items.filter(entry => entry.id !== saved.id)
  next.push(saved)
  writeMistakes(next)
  return saved
}

function updateMistake(id, patch) {
  const current = getMistake(id)
  if (!current) return null
  return saveMistake(Object.assign({}, current, normalizePatch(patch), {
    id,
    createdAt: current.createdAt
  }))
}

function normalizePatch(patch) {
  const source = patch && typeof patch === 'object' ? patch : {}
  return Object.assign({}, source, {
    ...(source.masteryLevel == null
      ? {}
      : { masteryLevel: normalizeAnalysis(source).masteryLevel })
  })
}

function deleteMistake(id) {
  writeMistakes(listMistakes().filter(item => item.id !== id))
}

function clearMistakes() {
  wx.removeStorageSync(MISTAKES_KEY)
  wx.removeStorageSync(LEGACY_QUESTIONS_KEY)
}

module.exports = {
  MISTAKES_KEY,
  LEGACY_QUESTIONS_KEY,
  listMistakes,
  getMistake,
  saveMistake,
  updateMistake,
  deleteMistake,
  clearMistakes,
  listQuestions: listMistakes,
  getQuestion: getMistake,
  upsertQuestion: saveMistake,
  deleteQuestion: deleteMistake,
  clearQuestions: clearMistakes,
  saveQuestions: writeMistakes
}
