const { createRecord, normalizeAnalysis } = require('./schema')

const MISTAKES_KEY = 'mistakes'
const LEGACY_QUESTIONS_KEY = 'public_exam_questions_v1'
const DELETIONS_KEY = 'mistake_deletions'

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
        lastReviewedAt: String(item.lastReviewedAt || ''),
        isFavorite: Boolean(item.isFavorite)
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

function listDeletions() {
  const value = wx.getStorageSync(DELETIONS_KEY)
  return Array.isArray(value) ? value : []
}

function writeDeletions(items) {
  wx.setStorageSync(DELETIONS_KEY, items)
}

function recordDeletions(ids) {
  const now = new Date().toISOString()
  const next = new Map(listDeletions().map(item => [item.id, item]))
  ids.forEach(id => next.set(id, { id, deletedAt: now }))
  writeDeletions(Array.from(next.values()))
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
  recordDeletions([id])
  writeMistakes(listMistakes().filter(item => item.id !== id))
}

function deleteMistakes(ids) {
  const idSet = new Set(Array.isArray(ids) ? ids : [])
  recordDeletions(Array.from(idSet))
  return writeMistakes(listMistakes().filter(item => !idSet.has(item.id)))
}

function toggleFavorite(id, forceValue) {
  const current = getMistake(id)
  if (!current) return null
  return updateMistake(id, {
    isFavorite: typeof forceValue === 'boolean'
      ? forceValue
      : !current.isFavorite
  })
}

function markReviewed(id, masteryLevel) {
  const current = getMistake(id)
  if (!current) return null
  return updateMistake(id, {
    masteryLevel,
    reviewCount: Number(current.reviewCount || 0) + 1,
    lastReviewedAt: new Date().toISOString()
  })
}

function clearMistakes() {
  recordDeletions(listMistakes().map(item => item.id))
  wx.removeStorageSync(MISTAKES_KEY)
  wx.removeStorageSync(LEGACY_QUESTIONS_KEY)
}

function applyCloudSnapshot(snapshot) {
  const source = snapshot && typeof snapshot === 'object' ? snapshot : {}
  const localById = new Map(listMistakes().map(item => [item.id, item]))
  const deletedIds = new Set(
    (Array.isArray(source.deletions) ? source.deletions : []).map(item => item.id)
  )
  const merged = (Array.isArray(source.items) ? source.items : [])
    .filter(item => !deletedIds.has(item.id))
    .map(item => {
      const local = localById.get(item.id)
      return Object.assign({}, item, {
        imagePath: local && local.imagePath
          ? local.imagePath
          : item.cloudImageUrl || ''
      })
    })
  writeMistakes(merged)
  writeDeletions([])
  return listMistakes()
}

module.exports = {
  MISTAKES_KEY,
  LEGACY_QUESTIONS_KEY,
  DELETIONS_KEY,
  listMistakes,
  getMistake,
  saveMistake,
  updateMistake,
  deleteMistake,
  deleteMistakes,
  toggleFavorite,
  markReviewed,
  clearMistakes,
  listDeletions,
  applyCloudSnapshot,
  listQuestions: listMistakes,
  getQuestion: getMistake,
  upsertQuestion: saveMistake,
  deleteQuestion: deleteMistake,
  clearQuestions: clearMistakes,
  saveQuestions: writeMistakes
}
