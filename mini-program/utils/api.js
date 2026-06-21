const { callContainer, CLOUD_ENV, CLOUD_SERVICE } = require('./cloud')
const { normalizeAnalysis } = require('./schema')

function parseData(value) {
  if (typeof value !== 'string') return value
  try {
    return JSON.parse(value)
  } catch (_) {
    return value
  }
}

function parseErrorBody(data, fallback) {
  const parsed = parseData(data)
  if (parsed && parsed.error && parsed.error.message) return parsed.error.message
  if (parsed && parsed.message) return parsed.message
  return fallback
}

async function healthCheck() {
  console.log('[healthCheck] cloud container:', {
    env: CLOUD_ENV,
    service: CLOUD_SERVICE,
    path: '/health'
  })
  try {
    const response = await callContainer({ path: '/health', method: 'GET' })
    const data = parseData(response.data)
    console.log('[healthCheck] response:', {
      statusCode: response.statusCode,
      data
    })
    const statusOk = response.statusCode >= 200 && response.statusCode < 300
    const bodyOk =
      data === 'ok' ||
      (data && data.status === 'ok') ||
      (data && data.ok === true) ||
      (data && data.success === true)
    if (statusOk || bodyOk) return data || { status: 'ok' }
    throw new Error(
      parseErrorBody(data, `云托管响应异常：HTTP ${response.statusCode}`)
    )
  } catch (error) {
    console.error('[healthCheck] callContainer failed:', error)
    throw new Error(error.errMsg || error.message || '无法连接微信云托管')
  }
}

function readImageBase64(filePath) {
  return new Promise((resolve, reject) => {
    wx.getFileSystemManager().readFile({
      filePath,
      encoding: 'base64',
      success: result => resolve(result.data),
      fail: error => reject(new Error(error.errMsg || '无法读取题目图片'))
    })
  })
}

function imageMimeType(filePath) {
  const path = String(filePath || '').toLowerCase()
  if (path.includes('.png')) return 'image/png'
  if (path.includes('.webp')) return 'image/webp'
  return 'image/jpeg'
}

async function analyzeImage(filePath, textHint = '', onProgress) {
  try {
    if (typeof onProgress === 'function') {
      onProgress({ phase: 'uploading', progress: 10 })
    }
    const imageBase64 = await readImageBase64(filePath)
    if (typeof onProgress === 'function') {
      onProgress({ phase: 'uploading', progress: 60 })
    }
    const response = await callContainer({
      path: '/api/analyze',
      method: 'POST',
      header: { 'content-type': 'application/json' },
      data: {
        imageBase64,
        imageMimeType: imageMimeType(filePath),
        textHint,
        clientType: 'wechat-mini-program',
        clientVersion: '1.2.0'
      }
    })
    if (typeof onProgress === 'function') {
      onProgress({ phase: 'analyzing', progress: 100 })
    }
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw new Error(
        parseErrorBody(response.data, `分析失败：HTTP ${response.statusCode}`)
      )
    }
    const parsed = parseData(response.data)
    const result = normalizeAnalysis(
      parsed && parsed.data && typeof parsed.data === 'object'
        ? parsed.data
        : parsed
    )
    if (!result.questionText) {
      throw new Error('后端未识别出有效题干，请重新拍摄或裁剪')
    }
    return result
  } catch (error) {
    console.error('[analyzeImage] callContainer failed:', error)
    throw new Error(error.errMsg || error.message || '微信云托管分析失败')
  }
}

module.exports = { healthCheck, analyzeImage }
