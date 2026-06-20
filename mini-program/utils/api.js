const { getBackendUrl } = require('./config')
const { normalizeAnalysis } = require('./schema')
const { getAccessToken, logout } = require('./auth')

function parseErrorBody(data, fallback) {
  try {
    const parsed = typeof data === 'string' ? JSON.parse(data) : data
    return parsed && parsed.error && parsed.error.message
      ? parsed.error.message
      : fallback
  } catch (_) {
    return fallback
  }
}

function networkMessage(error, fallback) {
  const message = String(error && error.errMsg ? error.errMsg : '')
  if (/timeout/i.test(message)) return 'AI 分析超时，请稍后重试'
  if (/fail|network|connect|domain/i.test(message)) return fallback
  return message || fallback
}

function healthCheck() {
  const backendUrl = getBackendUrl()
  if (!backendUrl) return Promise.reject(new Error('请先配置 AI 后端地址'))
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${backendUrl}/health`,
      method: 'GET',
      timeout: 15000,
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data)
        } else {
          reject(new Error(parseErrorBody(res.data, `健康检查失败：HTTP ${res.statusCode}`)))
        }
      },
      fail(error) {
        reject(new Error(networkMessage(error, '无法连接 AI 后端')))
      }
    })
  })
}

function analyzeImage(filePath, textHint = '', onProgress) {
  const backendUrl = getBackendUrl()
  if (!backendUrl) return Promise.reject(new Error('请先在设置页配置 AI 后端地址'))
  return new Promise((resolve, reject) => {
    const upload = (token, retryWithoutToken) => {
    const task = wx.uploadFile({
      url: `${backendUrl}/api/analyze`,
      filePath,
      name: 'image',
      header: token
        ? { Authorization: `Bearer ${token}` }
        : {},
      formData: {
        textHint,
        clientType: 'wechat-mini-program',
        clientVersion: '1.1.0'
      },
      timeout: 240000,
      success(res) {
        wx.hideNavigationBarLoading()
        if (typeof onProgress === 'function') {
          onProgress({ phase: 'analyzing', progress: 100 })
        }
        if (res.statusCode === 401 && retryWithoutToken) {
          logout()
          upload('', false)
          return
        }
        if (res.statusCode < 200 || res.statusCode >= 300) {
          const fallback = res.statusCode === 401
            ? '登录状态已失效，请在设置页重新登录'
            : `分析失败：HTTP ${res.statusCode}`
          reject(new Error(parseErrorBody(res.data, fallback)))
          return
        }
        try {
          const parsed = typeof res.data === 'string' ? JSON.parse(res.data) : res.data
          const result = normalizeAnalysis(
            parsed && parsed.data && typeof parsed.data === 'object'
              ? parsed.data
              : parsed
          )
          if (!result.questionText) {
            reject(new Error('后端未识别出有效题干，请重新拍摄或裁剪'))
            return
          }
          resolve(result)
        } catch (_) {
          reject(new Error('后端返回内容不是有效 JSON'))
        }
      },
      fail(error) {
        wx.hideNavigationBarLoading()
        reject(new Error(networkMessage(error, '图片上传失败，无法连接 AI 后端')))
      }
    })
    task.onProgressUpdate(progress => {
      if (typeof onProgress === 'function') {
        onProgress({
          phase: progress.progress < 100 ? 'uploading' : 'analyzing',
          progress: progress.progress
        })
      }
      if (progress.progress < 100) {
        wx.showNavigationBarLoading()
      } else {
        wx.hideNavigationBarLoading()
      }
    })
    }
    upload(getAccessToken(), true)
  })
}

module.exports = {
  healthCheck,
  analyzeImage
}
