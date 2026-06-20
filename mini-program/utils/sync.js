const { getBackendUrl } = require('./config')
const { getAccessToken, isLoggedIn, logout } = require('./auth')
const {
  listMistakes,
  listDeletions,
  applyCloudSnapshot,
  updateMistake
} = require('./storage')

let syncTimer = null
const LAST_SYNC_KEY = 'cloud_last_sync'
const SYNC_ERROR_KEY = 'cloud_sync_error'

function authenticatedRequest(path, data) {
  const backendUrl = getBackendUrl()
  const token = getAccessToken()
  if (!backendUrl || !token) return Promise.reject(new Error('请先登录云同步'))
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${backendUrl}${path}`,
      method: 'POST',
      header: {
        Authorization: `Bearer ${token}`
      },
      data,
      timeout: 30000,
      success(response) {
        if (response.statusCode >= 200 && response.statusCode < 300) {
          resolve(response.data)
          return
        }
        const message = response.data && response.data.error
          ? response.data.error.message
          : `同步失败：HTTP ${response.statusCode}`
        const error = new Error(message)
        error.statusCode = response.statusCode
        reject(error)
      },
      fail(error) {
        const message = String(error.errMsg || '')
        reject(new Error(
          /url not in domain list/i.test(message)
            ? '微信拦截了云同步请求。请在当前 AppID 的服务器域名中放行 https://api.pczhang.press。'
            : message || '无法连接云同步服务'
        ))
      }
    })
  })
}

function isLocalImage(path) {
  return path && !/^https?:\/\//i.test(path)
}

function uploadImage(filePath) {
  const backendUrl = getBackendUrl()
  const token = getAccessToken()
  return new Promise((resolve, reject) => {
    wx.uploadFile({
      url: `${backendUrl}/api/sync/images`,
      filePath,
      name: 'image',
      header: {
        Authorization: `Bearer ${token}`
      },
      timeout: 120000,
      success(response) {
        if (response.statusCode < 200 || response.statusCode >= 300) {
          let message = `图片同步失败：HTTP ${response.statusCode}`
          try {
            message = JSON.parse(response.data).error.message || message
          } catch (_) {}
          reject(new Error(message))
          return
        }
        try {
          resolve(JSON.parse(response.data).url)
        } catch (_) {
          reject(new Error('图片同步服务返回内容无效'))
        }
      },
      fail(error) {
        const message = String(error.errMsg || '')
        reject(new Error(
          /url not in domain list/i.test(message)
            ? '微信拦截了图片上传。请确认 uploadFile 合法域名包含 https://api.pczhang.press。'
            : message || '图片同步失败'
        ))
      }
    })
  })
}

async function uploadMissingImages(items, onProgress) {
  const candidates = items.filter(item =>
    isLocalImage(item.imagePath) && !item.cloudImageUrl
  )
  let completed = 0
  for (const item of candidates) {
    try {
      const cloudImageUrl = await uploadImage(item.imagePath)
      updateMistake(item.id, { cloudImageUrl })
      item.cloudImageUrl = cloudImageUrl
    } catch (_) {
      // 图片失败不阻断结构化错题同步，后续可再次补传。
    }
    completed += 1
    if (typeof onProgress === 'function') {
      onProgress({
        phase: 'images',
        completed,
        total: candidates.length
      })
    }
  }
}

async function syncNow(onProgress) {
  if (!isLoggedIn()) throw new Error('请先登录云同步')
  const items = listMistakes()
  await uploadMissingImages(items, onProgress)
  if (typeof onProgress === 'function') onProgress({ phase: 'records' })
  try {
    const result = await authenticatedRequest('/api/sync/mistakes', {
      items: listMistakes(),
      deletions: listDeletions()
    })
    const merged = applyCloudSnapshot(result)
    const serverTime = result.serverTime || new Date().toISOString()
    wx.setStorageSync(LAST_SYNC_KEY, serverTime)
    wx.removeStorageSync(SYNC_ERROR_KEY)
    return {
      count: merged.length,
      serverTime
    }
  } catch (error) {
    wx.setStorageSync(SYNC_ERROR_KEY, error.message || String(error))
    if (error.statusCode === 401) logout()
    throw error
  }
}

function getSyncState() {
  return {
    loggedIn: isLoggedIn(),
    lastSyncAt: String(wx.getStorageSync(LAST_SYNC_KEY) || ''),
    error: String(wx.getStorageSync(SYNC_ERROR_KEY) || '')
  }
}

function scheduleSync(delay = 1200) {
  if (!isLoggedIn()) return
  if (syncTimer) clearTimeout(syncTimer)
  syncTimer = setTimeout(() => {
    syncTimer = null
    syncNow().catch(() => {
      // 后台同步失败保持本地数据，设置页可手动重试。
    })
  }, delay)
}

module.exports = {
  authenticatedRequest,
  uploadImage,
  syncNow,
  scheduleSync,
  getSyncState,
  LAST_SYNC_KEY,
  SYNC_ERROR_KEY
}
