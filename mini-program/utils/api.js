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

function imageMimeType(filePath) {
  const path = String(filePath || '').toLowerCase()
  if (path.includes('.png')) return 'image/png'
  if (path.includes('.webp')) return 'image/webp'
  return 'image/jpeg'
}

function uploadTemporaryImage(filePath) {
  return new Promise((resolve, reject) => {
    const suffix = imageMimeType(filePath) === 'image/png'
      ? 'png'
      : imageMimeType(filePath) === 'image/webp'
        ? 'webp'
        : 'jpg'
    const cloudPath =
      `analysis-temp/${Date.now()}-${Math.random().toString(36).slice(2)}.${suffix}`
    console.log('[analyzeImage] stage=upload:start', {
      cloudPath,
      filePath
    })
    const task = wx.cloud.uploadFile({
      cloudPath,
      filePath,
      success: result => {
        console.log('[analyzeImage] stage=upload:success', result)
        resolve(result.fileID)
      },
      fail: error => {
        console.error('[analyzeImage] stage=upload:fail', error)
        const detail = error.errMsg || error.message || String(error)
        reject(new Error(`临时图片上传失败：${detail}`))
      }
    })
    if (task && typeof task.onProgressUpdate === 'function') {
      task.onProgressUpdate(progress => {
        console.log('[analyzeImage] stage=upload:progress', progress.progress)
      })
    }
    return task
  })
}

function getTemporaryUrl(fileID) {
  console.log('[analyzeImage] stage=temp-url:start', { fileID })
  return wx.cloud.getTempFileURL({
    fileList: [fileID]
  }).then(result => {
    console.log('[analyzeImage] stage=temp-url:response', result)
    const file = result.fileList && result.fileList[0]
    if (!file || !file.tempFileURL) {
      throw new Error(file?.errMsg || '无法获取临时图片地址')
    }
    return file.tempFileURL
  })
}

function deleteTemporaryImage(fileID) {
  if (!fileID) return Promise.resolve()
  return wx.cloud.deleteFile({ fileList: [fileID] }).catch(error => {
    console.warn('[analyzeImage] delete temp file failed:', error)
  })
}

async function analyzeImage(filePath, textHint = '', onProgress) {
  let fileID = ''
  let stage = 'upload'
  try {
    if (typeof onProgress === 'function') {
      onProgress({ phase: 'uploading', progress: 10 })
    }
    fileID = await uploadTemporaryImage(filePath)
    if (typeof onProgress === 'function') {
      onProgress({ phase: 'uploading', progress: 70 })
    }
    stage = 'temp-url'
    const imageUrl = await getTemporaryUrl(fileID)
    stage = 'container'
    console.log('[analyzeImage] stage=container:start', {
      path: '/api/analyze',
      hasImageUrl: Boolean(imageUrl)
    })
    const response = await callContainer({
      path: '/api/analyze',
      method: 'POST',
      header: { 'content-type': 'application/json' },
      data: {
        imageUrl,
        textHint,
        clientType: 'wechat-mini-program',
        clientVersion: '1.2.1'
      }
    })
    console.log('[analyzeImage] stage=container:response', {
      statusCode: response.statusCode,
      data: response.data
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
    console.error('[analyzeImage] failed:', { stage, error })
    const message = error.errMsg || error.message || String(error)
    const stageLabel = {
      upload: '临时图片上传失败',
      'temp-url': '获取临时图片地址失败',
      container: '微信云托管分析失败'
    }[stage] || '图片分析失败'
    throw new Error(message.startsWith(stageLabel)
      ? message
      : `${stageLabel}：${message}`)
  } finally {
    await deleteTemporaryImage(fileID)
  }
}

module.exports = { healthCheck, analyzeImage }
