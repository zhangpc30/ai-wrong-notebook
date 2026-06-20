const { getBackendUrl } = require('./config')

const ACCESS_TOKEN_KEY = 'cloud_access_token'
const CLOUD_USER_KEY = 'cloud_user'

function getAccessToken() {
  return String(wx.getStorageSync(ACCESS_TOKEN_KEY) || '')
}

function getCloudUser() {
  const user = wx.getStorageSync(CLOUD_USER_KEY)
  return user && typeof user === 'object' ? user : null
}

function isLoggedIn() {
  return Boolean(getAccessToken() && getCloudUser())
}

function requestLoginCode() {
  return new Promise((resolve, reject) => {
    wx.login({
      success(result) {
        if (result.code) resolve(result.code)
        else reject(new Error('微信未返回登录 code'))
      },
      fail: reject
    })
  })
}

function requestJson(url, data) {
  return new Promise((resolve, reject) => {
    wx.request({
      url,
      method: 'POST',
      data,
      timeout: 20000,
      success(response) {
        if (response.statusCode >= 200 && response.statusCode < 300) {
          resolve(response.data)
          return
        }
        const message = response.data && response.data.error
          ? response.data.error.message
          : `登录失败：HTTP ${response.statusCode}`
        reject(new Error(message))
      },
      fail(error) {
        reject(new Error(error.errMsg || '无法连接登录服务'))
      }
    })
  })
}

async function login(options = {}) {
  const backendUrl = getBackendUrl()
  if (!backendUrl) throw new Error('请先配置 AI 后端地址')
  const payload = options.devUserId
    ? { devUserId: options.devUserId }
    : { code: await requestLoginCode() }
  const result = await requestJson(`${backendUrl}/api/auth/wechat`, payload)
  if (!result.accessToken || !result.user) {
    throw new Error('登录服务返回数据不完整')
  }
  wx.setStorageSync(ACCESS_TOKEN_KEY, result.accessToken)
  wx.setStorageSync(CLOUD_USER_KEY, result.user)
  return result.user
}

function logout() {
  wx.removeStorageSync(ACCESS_TOKEN_KEY)
  wx.removeStorageSync(CLOUD_USER_KEY)
}

module.exports = {
  ACCESS_TOKEN_KEY,
  CLOUD_USER_KEY,
  getAccessToken,
  getCloudUser,
  isLoggedIn,
  login,
  logout
}
