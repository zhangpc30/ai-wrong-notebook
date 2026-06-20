const BACKEND_URL_KEY = 'ai_backend_url'
const LEGACY_BACKEND_URL_KEY = 'public_exam_backend_url'

function normalizeBackendUrl(value) {
  return String(value || '').trim().replace(/\/+$/, '')
}

function getBackendUrl() {
  const current = normalizeBackendUrl(wx.getStorageSync(BACKEND_URL_KEY))
  if (current) return current

  const legacy = normalizeBackendUrl(wx.getStorageSync(LEGACY_BACKEND_URL_KEY))
  if (legacy) {
    wx.setStorageSync(BACKEND_URL_KEY, legacy)
  }
  return legacy
}

function setBackendUrl(value) {
  const normalized = normalizeBackendUrl(value)
  if (normalized) {
    wx.setStorageSync(BACKEND_URL_KEY, normalized)
  } else {
    wx.removeStorageSync(BACKEND_URL_KEY)
  }
  const app = typeof getApp === 'function' ? getApp() : null
  if (app && app.globalData) app.globalData.backendUrl = normalized
  return normalized
}

function isValidBackendUrl(value) {
  return /^https?:\/\/[^/\s]+(?:\/.*)?$/i.test(normalizeBackendUrl(value))
}

module.exports = {
  BACKEND_URL_KEY,
  LEGACY_BACKEND_URL_KEY,
  getBackendUrl,
  setBackendUrl,
  normalizeBackendUrl,
  isValidBackendUrl
}
