const BACKEND_URL_KEY = 'ai_backend_url'
const LEGACY_BACKEND_URL_KEY = 'public_exam_backend_url'
const FIXED_BACKEND_URL = 'https://api.pczhang.press'

function normalizeBackendUrl(value) {
  return String(value || '').trim().replace(/\/+$/, '')
}

function getBackendUrl() {
  return FIXED_BACKEND_URL
}

function setBackendUrl() {
  // 后端地址由发布版本统一管理，不再读取用户输入或历史缓存。
  wx.removeStorageSync(BACKEND_URL_KEY)
  wx.removeStorageSync(LEGACY_BACKEND_URL_KEY)
  const app = typeof getApp === 'function' ? getApp() : null
  if (app && app.globalData) app.globalData.backendUrl = FIXED_BACKEND_URL
  return FIXED_BACKEND_URL
}

function isValidBackendUrl(value) {
  return normalizeBackendUrl(value) === FIXED_BACKEND_URL
}

module.exports = {
  BACKEND_URL_KEY,
  LEGACY_BACKEND_URL_KEY,
  FIXED_BACKEND_URL,
  getBackendUrl,
  setBackendUrl,
  normalizeBackendUrl,
  isValidBackendUrl
}
